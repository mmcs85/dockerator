const assert = require('assert')
import { suite, test, timeout } from 'mocha-typescript'
import Dockerator from '../src/dockerator'

@suite
class DockeratorTests {
  @test(timeout(10000)) public async runDockerfile() {
    const dock = new Dockerator({
      image: 'dfuse-eos',
      command: ['cleos', '--help']
    })
    await dock.setup({ context: 'docker', src: ['Dockerfile'] })
    await dock.start({ blockUntilExit: true })
    await dock.remove()
  }

  @test public async runFalse() {
    const dock = new Dockerator({
      image: 'ubuntu:18.04',
      command: ['bash', '-c', 'echo "Some falsehood" && false']
    })
    await dock.setup()
    await assert.rejects(dock.start({ blockUntilExit: true }))
    await dock.remove()
  }

  @test public async runError() {
    const dock = new Dockerator({
      image: 'ubuntu:18.04',
      command: ['bash', '-c', 'cd some/non-existent/directory']
      // stdio: 'ignore'
    })
    await dock.setup()
    await assert.rejects(dock.start({ blockUntilExit: true }))
    await dock.remove()
  }

  @test public async runTrue() {
    const dock = new Dockerator({
      image: 'ubuntu:18.04',
      command: ['bash', '-c', 'echo "Some truth" && true']
    })
    await dock.setup()
    await dock.start({ blockUntilExit: true })
    await dock.remove()
  }

  @test(timeout(20000)) public async runMongeMultipleTimes() {
    const dock = new Dockerator({
      image: 'mongo:4.0.6',
      portMappings: ['27017:27017']
    })
    await dock.setup()
    await dock.start()
    await new Promise(resolve => setTimeout(() => resolve(), 3000))
    await dock.stop({ autoRemove: false })
    await new Promise(resolve => setTimeout(() => resolve(), 3000))
    await dock.start()
    await new Promise(resolve => setTimeout(() => resolve(), 3000))
    await dock.stop()
  }

  @test(timeout(10000)) public async runMongo() {
    const dock = new Dockerator({
      image: 'mongo:4.0.6',
      portMappings: ['27017:27017']
    })
    await dock.setup()
    await dock.start()
    await new Promise(resolve => setTimeout(() => resolve(), 6000))
    await dock.stop()
  }
}
