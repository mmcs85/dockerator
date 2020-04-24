const assert = require('assert')
import { suite, test, timeout } from 'mocha-typescript'
import Dockerator from '../src/dockerator'

@suite
class DockeratorTests {
  @test(timeout(10000)) public async runDockerfile() {
    const dock = new Dockerator({
      image: 'eosio-operator',
      command: ['cleos', '--help']
    })
    await dock.setup({ context: 'docker', src: ['Dockerfile'] })
    await dock.start({ untilExit: true })
  }

  @test public async runFalse() {
    const dock = new Dockerator({
      image: 'ubuntu:18.04',
      command: ['bash', '-c', 'echo "Some falsehood" && false']
    })
    await dock.setup()
    assert.rejects(dock.start({ untilExit: true }))
  }

  @test public async runError() {
    const dock = new Dockerator({
      image: 'ubuntu:18.04',
      command: ['bash', '-c', 'cd some/non-existent/directory']
      // stdio: 'ignore'
    })
    await dock.setup()
    assert.rejects(dock.start({ untilExit: true }))
  }

  @test public async runTrue() {
    const dock = new Dockerator({
      image: 'ubuntu:18.04',
      command: ['bash', '-c', 'echo "Some truth" && true']
    })
    await dock.setup()
    await dock.start({ untilExit: true })
  }

  @test(timeout(10000)) public async runMongo() {
    const dock = new Dockerator({
      image: 'mongo:4.0.6',
      portMappings: ['27017:27017']
    })
    await dock.setup()
    dock.loadExitHandler()
    dock.start({ untilExit: true })
    await new Promise(resolve => setTimeout(() => resolve(), 6000))
    await dock.stop()
  }
}
