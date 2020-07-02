import * as github from '@actions/github'
import * as main from '../src/main'

// Frankly, tests would be entirely useless unless we can mock GitHub somehow.
describe('Upload Release Action', () => {
  let spyGetOctokit: jest.SpyInstance<any>
  let mockOctokit: any

  beforeEach(() => {
    mockOctokit = {
      repos: {
        createRelease: jest.fn(async () => ({
          data: {
            id: 'lalala',
            upload_url: 'oaoa'
          }
        }))
      }
    }
    // spyGetOctokit = jest.spyOn(github, "getOctokit").mockImplementation(() => mockOctokit
    // jest.spyOn(github, "context", "get").mockImplementation(() => "testtest");
  })

  it('pls write actual test', async () => {})
})
