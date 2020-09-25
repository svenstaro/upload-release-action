# Changelog

## [2.1.1] - 2020-09-25
- Fix `release_name` option [#27](https://github.com/svenstaro/upload-release-action/pull/27) (thanks @kittaakos)

## [2.1.0] - 2020-08-10
- Strip refs/heads/ from the input tag [#23](https://github.com/svenstaro/upload-release-action/pull/23) (thanks @OmarEmaraDev)

## [2.0.0] - 2020-07-03
- Add `prerelease` input parameter. Setting this marks the created release as a pre-release.
- Add `release_name` input parameter. Setting this explicitly sets the title of the release.
- Add `body` input parameter. Setting this sets the text content of the created release.
- Add `browser_download_url` output variable. This contains the publicly accessible download URL of the uploaded artifact.
- Allow for leaving `asset_name` unset. This will cause the asset to use the filename.
