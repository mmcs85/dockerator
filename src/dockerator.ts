import Docker from 'dockerode'
import { Readable, Writable } from 'stream'

export = class Dockerator {
  public docker: Docker
  public image: string
  public command?: string[]
  public detach: boolean
  public portMappings: Array<[string | number, string | number]>
  public stdio: { stdout?: Writable; stderr?: Writable }
  public dockerConfig: any
  public container?: Docker.Container
  public containerStream?: Readable
  public finished?: Promise<unknown>

  constructor({
    image,
    command,
    detach = false,
    portMappings = [],
    stdio = 'inherit',
    dockerConfig = {}
  }: {
    image: string
    command?: string[]
    detach?: boolean
    portMappings?: Array<string | [number | string, number | string]>
    stdio?: 'ignore' | 'inherit' | { stdout?: Writable; stderr?: Writable }
    dockerConfig?: any
  }) {
    this.docker = new Docker()
    this.image = image
    this.command = command
    this.detach = detach
    this.portMappings = portMappings.map(m =>
      Array.isArray(m) ? m : (m.split(':') as [string, string])
    )
    if (detach || stdio === 'ignore') {
      this.stdio = {}
    } else if (stdio === 'inherit') {
      this.stdio = {
        stdout: global.process.stdout,
        stderr: global.process.stderr
      }
    } else {
      this.stdio = stdio
    }
    this.dockerConfig = dockerConfig
  }

  public async setup(dockerfile?: { context: string; src: string[] }) {
    try {
      await this.docker.getImage(this.image).inspect()
    } catch (error) {
      if (error.statusCode === 404) {
        if (this.stdio.stdout && this.stdio.stdout.writable) {
          this.stdio.stdout.write('Preparing docker image...\n')
        }
        const stream = dockerfile
          ? await this.docker.buildImage(dockerfile, { t: this.image })
          : await this.docker.pull(this.image, {})
        await new Promise((resolve, reject) => {
          this.docker.modem.followProgress(
            stream,
            (error: Error, result: any) =>
              error ? reject(error) : resolve(result)
          )
        })
        if (this.stdio.stdout && this.stdio.stdout.writable) {
          this.stdio.stdout.write('Docker image ready\n')
        }
      } else {
        throw error
      }
    }
  }

  public async start({ containerId = '', blockUntilExit = false } = {}) {
    if (containerId) {
      this.container = this.docker.getContainer(containerId)
      await this.container.inspect()
    } else if (!this.container) {
      this.container = await this.createContainer(containerId)
    }
    if (!this.detach) {
      await this.attachContainerStream(blockUntilExit)
    }
    try {
      await this.container.start()
    } finally {
      if (blockUntilExit) {
        await this.finished
      }
    }
  }

  public async stop({ autoRemove = true } = {}) {
    if (!this.container) {
      throw new Error('Cannot stop container before starting it')
    }
    try {
      await this.container.stop({ t: 10 })
      if (autoRemove) {
        await this.remove()
      }
    } catch (e) {
      if (e.statusCode !== 409 && e.statusCode !== 304) {
        throw e
      }
    }
  }

  public async remove() {
    if (!this.container) {
      throw new Error('Cannot stop container before starting it')
    }
    try {
      await this.container.remove({ v: true, force: true })
      this.container = undefined
      if (this.stdio.stdout) {
        this.stdio.stdout = undefined
      }
      if (this.stdio.stderr) {
        this.stdio.stderr = undefined
      }
      if (this.containerStream) {
        this.containerStream.destroy()
        this.containerStream = undefined
      }
    } catch (e) {
      if (e.statusCode !== 409 && e.statusCode !== 304) {
        throw e
      }
    }
  }

  public async createContainer(containerId = '') {
    return this.docker.createContainer({
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,
      Image: this.image,
      ExposedPorts: this.portMappings.reduce(
        (result: { [port: string]: {} }, m) => {
          result[`${m[0]}/tcp`] = {}
          return result
        },
        {}
      ),
      HostConfig: {
        PortBindings: this.portMappings.reduce(
          (
            result: {
              [port: string]: Array<{ HostIp: '0.0.0.0'; HostPort: string }>
            },
            m
          ) => {
            result[`${m[0]}/tcp`] = [
              {
                HostIp: '0.0.0.0',
                HostPort: String(m[1])
              }
            ]
            return result
          },
          {}
        )
      },
      Cmd: this.command || undefined,
      ...this.dockerConfig
    })
  }

  public async attachContainerStream(blockUntilExit = false) {
    if (!this.container) {
      throw new Error('Cannot create container stream')
    }

    this.containerStream = ((await this.container.attach({
      stream: true,
      stdout: true,
      stderr: true
    })) as any) as Readable

    if (blockUntilExit) {
      let markSuccess: () => void
      let markError: (error: any) => void
      this.finished = new Promise((resolve, reject) => {
        markSuccess = resolve
        markError = reject
      })
      const executionErrorMsg =
        'Execution error.' +
        (this.stdio.stdout && this.stdio.stdout.writable
          ? ''
          : ' If you need more details, enable container stdout.')
      if (process.platform !== 'win32') {
        this.containerStream.once('end', () => {
          if (!this.container) {
            if (this.containerStream) {
              this.containerStream.destroy()
            }
            return
          }
          this.container
            .inspect()
            .then(({ State }) => {
              if (State.Status === 'exited' && State.ExitCode === 0) {
                markSuccess()
              } else {
                const error = new Error(State.Error || executionErrorMsg)
                ;(error as any).exitCode = State.ExitCode
                markError(error)
              }
            })
            .catch(markError)
        })
      } else {
        const checkerHandler = setInterval(() => {
          if (!this.container) {
            if (this.containerStream) {
              this.containerStream.destroy()
            }
            return
          }
          this.container
            .inspect()
            .then(({ State }) => {
              if (State.Status === 'running') {
                return
              }
              if (State.Status === 'exited' && State.ExitCode === 0) {
                markSuccess()
              } else {
                const error = new Error(State.Error || executionErrorMsg)
                ;(error as any).exitCode = State.ExitCode
                markError(error)
              }
              clearInterval(checkerHandler)
              if (this.containerStream) {
                this.containerStream.destroy()
              }
            })
            .catch(error => {
              markError(error)
              clearInterval(checkerHandler)
              if (this.containerStream) {
                this.containerStream.destroy()
              }
            })
        }, 1000)
      }
    }

    if (this.stdio.stdout && this.stdio.stdout.writable) {
      this.containerStream.setEncoding('utf8')
      this.containerStream.pipe(
        this.stdio.stdout,
        { end: true }
      )
    } else {
      this.containerStream.on('data', () => {
        // Discard data
      })
    }
  }

  public loadExitHandler(process = global.process) {
    const exitHandler = () => {
      this.stop().finally(() => {
        process.exit()
      })
    }
    process.on('SIGINT', exitHandler)
    process.on('SIGTERM', exitHandler)
  }
}
