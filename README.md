# Upload files to a GitHub release [![GitHub Actions Workflow](https://github.com/svenstaro/upload-release-action/workflows/PR%20Checks/badge.svg)](https://github.com/svenstaro/upload-release-action/actions)

This action allows you to select which files to upload to the just-tagged release.
It runs on all operating systems types offered by GitHub.

## Input variables

You must provide:

- `repo_token`: Usually you'll want to set this to `${{ secrets.GITHUB_TOKEN }}`.
- `file`: A local file to be uploaded as the asset.
- `tag`: The tag to upload into. If you want the current event's tag, use `${{ github.ref }}` (the `refs/tags/` prefix will be automatically stripped).

Optional Arguments

- `asset_name`: The name the file gets as an asset on a release. Use `$tag` to include the tag name. When not provided it will default to the filename.
                This is not used if `file_glob` is set to `true`.
- `file_glob`: If set to true, the file argument can be a glob pattern (`asset_name` is ignored in this case) (Default: `false`)
- `overwrite`: If an asset with the same name already exists, overwrite it (Default: `false`).
- `prerelease`: Mark the release as a pre-release (Default: `false`).
- `release_name`: Explicitly set a release name. (Defaults: implicitly same as `tag` via GitHub API).
- `body`: Content of the release text (Defaut: `""`).

## Output variables

- `browser_download_url`: The publicly available URL of the asset.

## Usage

This usage assumes you want to build on tag creations only.
This is a common use case as you will want to upload release binaries for your tags.

Simple example:

```yaml
name: Publish

on:
  push:
    tags:
      - '*'

jobs:
  build:
    name: Publish binaries
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/mything
        asset_name: mything
        tag: ${{ github.ref }}
        overwrite: true
        body: "This is my release text"
```

Complex example with more operating systems:

```yaml
name: Publish

on:
  push:
    tags:
      - '*'

jobs:
  publish:
    name: Publish for ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            artifact_name: mything
            asset_name: mything-linux-amd64
          - os: windows-latest
            artifact_name: mything.exe
            asset_name: mything-windows-amd64
          - os: macos-latest
            artifact_name: mything
            asset_name: mything-macos-amd64

    steps:
    - uses: actions/checkout@v2
    - name: Build
      run: cargo build --release --locked
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/${{ matrix.artifact_name }}
        asset_name: ${{ matrix.asset_name }}
        tag: ${{ github.ref }}
```

Example with `file_glob`:
```yaml
name: Publish
on:
  push:
    tags:
      - '*'
jobs:
  build:
    name: Publish binaries
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v2
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/my*
        tag: ${{ github.ref }}
        overwrite: true
        file_glob: true
```

## Releasing

To release this Action:

- Bump version in `package.json`
- Create `CHANGELOG.md` entry
- `npm run all`
- `git commit -am <version>`
- `git tag -sm <version> <version>`
- `git push --follow-tags`
- Go to https://github.com/svenstaro/upload-release-action/releases and publish the new version
