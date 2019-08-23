# Upload files to a GitHub release

This action allows you to select which files to upload to the just-tagged release.
It runs on all operating systems types offered by GitHub.

## Input variables:

You must provide:

- `repo_token`: Usually you'll want to set this to `${{ secrets.GITHUB_TOKEN }}`
- `file`: A local file to be uploaded as the asset.
- `asset_name`: The name the file gets as an asset on a release.
- `tag`: The tag to uploaded into. If you want the current event's tag, use `${{ github.event.ref }}`
- `overwrite`: If an asset with name already exists, overwrite it.

## Usage

This usage assumes you want to build on tag creations only.
This is a common use case as you will want to upload release binaries for your tags.

Simple example:

```yaml
name: Publish

on:
  create:
    tags:

jobs:
  build:
    name: Publish binaries
    runs-on: ubuntu-latest

    steps:
    - uses: hecrj/setup-rust-action@v1-release
      with:
        rust-version: stable
    - uses: actions/checkout@v1
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v1-release
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/mything
        asset_name: mything
        tag: {{ github.event.ref }}
        overwrite: true
```

Complex example with more operating systems:

```yaml
name: Publish

on:
  create:
    tags:

jobs:
  build:
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
    - uses: hecrj/setup-rust-action@v1-release
      with:
        rust-version: stable
    - uses: actions/checkout@v1
    - name: Build
      run: cargo build --release
    - name: Upload binaries to release
      uses: svenstaro/upload-release-action@v1-release
      with:
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        file: target/release/${{ matrix.artifact_name }}
        asset_name: ${{ matrix.asset_name }}
```
