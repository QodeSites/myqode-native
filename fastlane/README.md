fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios check

```sh
[bundle exec] fastlane ios check
```

Read-only: can the key see the app? Lists its versions and the newest builds

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Upload screenshots and texts to the App Store version (no submission)

### ios submit

```sh
[bundle exec] fastlane ios submit
```

Attach a processed build, set manual release, submit for App Review

### ios release

```sh
[bundle exec] fastlane ios release
```

Release the approved version to the App Store (Pending Developer Release → live)

----


## Android

### android check

```sh
[bundle exec] fastlane android check
```

Read-only: can the service account see the app? Shows the production track

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Upload Play listing screenshots and texts (no release)

### android submit

```sh
[bundle exec] fastlane android submit
```

Upload an .aab to the production track as a DRAFT (send for review from Play Console or with release)

### android review

```sh
[bundle exec] fastlane android review
```

Send the production draft (and the listing) for Google review. ONLY with Managed publishing ON: then an approved release waits for Publish in Play Console (or the release lane)

### android release

```sh
[bundle exec] fastlane android release
```

Publish the production draft to a share of users (rollout:0.2 = 20%, 1.0 = everyone)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
