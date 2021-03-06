///<reference path='../globals.d.ts' />

import * as proxyquire from 'proxyquire'
import {resolve} from 'path'
import readFixture from './support/read-fixture'
import parseOptions from '../../src/parse-options'

const failedSingleTestOutput = readFixture('failed-test-output.txt')
const failedShardedTestOutput = readFixture('sharded-failed-test-output.txt')
const failedJasmineSpecReporterTestOutput = readFixture('failed-jasmine-spec-reporter-test-output.txt')
const failedShardedJasmineSpecReporterTestOutput = readFixture('multicapabilities-failed-jasmine-spec-reporter-test-output.txt')

describe('Protractor Flake', () => {
  let spawnStub: any = null
  let protractorFlake: any = null

  function pathToProtractor () {
    return resolve(require.resolve('protractor'), '../../bin/protractor')
  }

  beforeEach(() => {
    spawnStub = global.sandbox.stub().returns({
      on (event: string, callback: any) {
        spawnStub.endCallback = callback
      },
      stdout: {
        on (event: string, callback: any) {
          spawnStub.dataCallback = callback
        }
      },
      stderr: {
        on (event: string, callback: any) {
          spawnStub.dataCallback = callback
        }
      }
    })

    protractorFlake = proxyquire('../../src/index', {
      child_process: {
        spawn: spawnStub
      }
    })
  })

  it('uses node to run protractor', () => {
    protractorFlake()

    expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '1'])
  })

  context('failed specs', () => {
    it('calls callback with an err if a negative status is returned', (done) => {
      protractorFlake({maxAttempts: 1}, (status: number) => {
        expect(status).to.equal(status, 1)
        done()
      })

      spawnStub.endCallback(1)
    })

    it('calls callback with an err if a negative status is after multiple attempts', function (done) {
      protractorFlake({maxAttempts: 3}, (status: number) => {
        expect(status).to.equal(status, 1)
        done()
      })

      spawnStub.endCallback(1)
      spawnStub.endCallback(1)
      spawnStub.endCallback(1)
    })

    it('calls callback with output from protractor process', (done) => {
      protractorFlake({maxAttempts: 1}, (status: number, output: string) => {
        expect(status).to.equal(status, 1)
        expect(output).to.equal('Test')
        done()
      })

      spawnStub.dataCallback('Test')
      spawnStub.endCallback(1)
    })

    it('does not blow up if no callback is passed', function () {
      protractorFlake({maxAttempts: 1})

      expect(() => {
        spawnStub.endCallback(1)
      }).to.not.throw()
    })

    it('isolates individual failed specs from protractor output', () => {
      protractorFlake({maxAttempts: 3})

      spawnStub.dataCallback(failedSingleTestOutput)
      spawnStub.endCallback(1)
      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '2', '--params.flake.retry', 'true', '--specs', '/tests/a-flakey.test.js'])
    })

    it('isolates individual failed specs from jasmine-spec-reporter output', () => {
      protractorFlake({maxAttempts: 3})

      spawnStub.dataCallback(failedJasmineSpecReporterTestOutput)
      spawnStub.endCallback(1)

      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '2', '--params.flake.retry', 'true', '--specs', '/tests/flakey.test.js'])
    })

    it('isolates individual failed specs for sharded jasmine-spec-reporter output', () => {
      protractorFlake({maxAttempts: 3})

      spawnStub.dataCallback(failedShardedJasmineSpecReporterTestOutput)
      spawnStub.endCallback(1)

      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '2', '--params.flake.retry', 'true', '--specs', '/tests/flakey.test.js'])
    })

    it('isolates failed specs for sharded protractor output', () => {
      protractorFlake({maxAttempts: 3})

      spawnStub.dataCallback(failedShardedTestOutput)
      spawnStub.endCallback(1)

      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '2', '--params.flake.retry', 'true', '--specs', '/tests/a-flakey.test.js,/tests/another-flakey.test.js'])
    })

    context('with --suite in protractorArgs', function () {
      it('removes --suite argument from protractorArgs if it is passed', () => {
        protractorFlake({
          maxAttempts: 3,
          protractorArgs: [
            '--suite=fail',
            '--suite', 'fail',
            '--should-remain=yes'
          ]
        })

        spawnStub.dataCallback(failedShardedTestOutput)
        spawnStub.endCallback(1)

        expect(spawnStub).to.have.been.calledWith('node', [
          pathToProtractor(),
          '--should-remain=yes',
          '--params.flake.iteration', '2',
          '--params.flake.retry', 'true',
          '--specs', '/tests/a-flakey.test.js,/tests/another-flakey.test.js'
        ])
      })

      it('does not remove --suite for first test run', () => {
        protractorFlake({
          maxAttempts: 3,
          protractorArgs: ['--suite=fail']
        })

        expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--suite=fail', '--params.flake.iteration', '1'])
      })
    })

    context('with --specs in protractorArgs', function () {
      it('removes --specs argument from protractorArgs if it is passed', () => {
        protractorFlake({
          maxAttempts: 3,
          protractorArgs: [
            '--specs=specs/fail',
            '--should-remain=yes',
            '--specs', 'specs/fail'
          ]
        })

        spawnStub.dataCallback(failedShardedTestOutput)
        spawnStub.endCallback(1)

        expect(spawnStub).to.have.been.calledWith('node', [
          pathToProtractor(),
          '--should-remain=yes',
          '--params.flake.iteration', '2',
          '--params.flake.retry', 'true',
          '--specs', '/tests/a-flakey.test.js,/tests/another-flakey.test.js'
        ])
      })

      it('does not remove --specs for first test run', () => {
        protractorFlake({
          maxAttempts: 3,
          protractorArgs: ['--specs=specs/fail', '--specs', 'specs/fail']
        })

        expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--specs=specs/fail', '--specs', 'specs/fail', '--params.flake.iteration', '1'])
      })
    })
  })

  context('options', () => {
    it('allows a different path for protractor by using protractorPath option', () => {
      protractorFlake({protractorPath: '/arbitrary/path/to/protractor'})

      expect(spawnStub).to.have.been.calledWith('node', ['/arbitrary/path/to/protractor', '--params.flake.iteration', '1'])
    })

    it('allows a different path for node by using nodeBin option', () => {
      protractorFlake({nodeBin: '/path/node'})

      expect(spawnStub).to.have.been.calledWith('/path/node', [pathToProtractor(), '--params.flake.iteration', '1'])
    })

    it('passes protractorArgs to spawned protractor process', () => {
      protractorFlake({protractorArgs: ['--suite=fail']})

      expect(spawnStub).to.have.been.calledWithMatch('node', [pathToProtractor(), '--suite=fail', '--params.flake.iteration', '1'])
    })

    it('uses protractorSpawnOptions for spawned protractor process', () => {
      protractorFlake({protractorSpawnOptions: { cwd: './' }})

      expect(spawnStub).to.have.been.calledWithMatch('node', [pathToProtractor(), '--params.flake.iteration', '1'], { cwd: './' })
    })

    it('uses protractorRetryConfig file for spawned protractor process only after first attempt', () => {
      protractorFlake({protractorRetryConfig: __dirname + '/support/protractor.flake.config.js'})
      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '1'])
      spawnStub.dataCallback(failedSingleTestOutput)
      spawnStub.endCallback(1)
      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '2', '--params.flake.retry', 'true', '--specs', '/tests/a-flakey.test.js', resolve(__dirname + '/support/protractor.flake.config.js')])
    })

    it('uses protractorRetryConfig cli args for spawned protractor process only after first attempt', () => {
      protractorFlake({protractorRetryConfig: '--capabilities.browser=chrome --capabilities.sharding=false'})
      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '1'])
      spawnStub.dataCallback(failedSingleTestOutput)
      spawnStub.endCallback(1)
      expect(spawnStub).to.have.been.calledWith('node', [pathToProtractor(), '--params.flake.iteration', '2', '--params.flake.retry', 'true', '--specs', '/tests/a-flakey.test.js', '--capabilities.browser=chrome --capabilities.sharding=false'])
    })

    context('color option', () => {
      it('defaults to magenta color', () => {
        expect(parseOptions({})).to.include({color: 'magenta'})
      })

      it('disables when color is set to (bool)false', () => {
        let options = {
          color: false
        }
        expect(parseOptions(options)).to.include({color: false})
      })

      it('disables when color is set to (string)false', () => {
        let options = {
          color: 'false'
        }
        expect(parseOptions(options)).to.include({color: false})
      })

      it('sets a custom color', () => {
        let options = {
          color: 'yellow'
        }
        expect(parseOptions(options)).to.include({color: 'yellow'})
      })

      it('throws an exeption when invalid color is used', () => {
        let options = {
          color: 'yolo'
        }
        expect(() => { parseOptions(options) }).to.throw('Invalid color option. Color must be one of the supported chalk colors: https://github.com/chalk/ansi-styles#colors')
      })
    })
  })
})
