# Flathub Submission Guide

This guide explains how to submit Crystal to Flathub for verified distribution.

## Current Status

Crystal currently builds a standalone Flatpak bundle (.flatpak file) that users can manually download and install. This is NOT the same as being on Flathub.

## Benefits of Flathub

- **Verification Badge**: Shows users the app is from the official developer
- **Automatic Updates**: Users get updates through their system
- **Discoverability**: Appears in GNOME Software, KDE Discover, etc.
- **Trust**: Flathub reviews and builds from source

## Submission Process

### 1. Prerequisites

- [ ] Stable release (not beta/alpha)
- [ ] Domain verification token at https://stravu.com/.well-known/org.flathub.VerifiedApps.txt
- [ ] AppStream metadata (already created: `com.stravu.crystal.metainfo.xml`)
- [ ] Screenshots for the app store
- [ ] Stable API key management (don't embed keys)

### 2. Create Flathub Repository

1. Fork https://github.com/flathub/flathub
2. Create new branch: `new-app-com.stravu.crystal`
3. Add your Flatpak manifest (modified version)

### 3. Modify Manifest for Flathub

The current `com.stravu.crystal.yml` needs changes for Flathub:

```yaml
# Instead of using local AppImage:
sources:
  - type: archive
    url: https://github.com/stravu/crystal/releases/download/v0.1.4/Crystal-0.1.4-x64.AppImage
    sha256: <sha256sum>
    
# Or better, build from source:
sources:
  - type: git
    url: https://github.com/stravu/crystal.git
    tag: v0.1.4
```

### 4. Domain Verification

Create file at: https://stravu.com/.well-known/org.flathub.VerifiedApps.txt
Content:
```
com.stravu.crystal
```

### 5. Submit PR

1. Open PR to flathub/flathub
2. Title: "Add Crystal - Multi-Session Claude Code Manager"
3. Wait for review (can take weeks)

## Important Considerations

### API Keys

Flathub apps should NOT embed API keys. Consider:
- User provides their own Anthropic API key
- OAuth flow for key management
- Secure credential storage

### Permissions

Review the Flatpak permissions in manifest:
- `--filesystem=home` might be too broad
- Consider using portals for file access
- Document why each permission is needed

### Updates

Once on Flathub:
- They build from source (not your binaries)
- You update by submitting PRs to your Flathub repo
- Users get automatic updates

## Alternative: Self-Hosted Repository

If Flathub submission is not desired, you can:

1. Host your own Flatpak repository
2. Users add: `flatpak remote-add crystal https://flatpak.stravu.com/repo`
3. Less discoverable but more control

## Resources

- Flathub Docs: https://docs.flathub.org/docs/for-app-authors/submission
- Verification: https://docs.flathub.org/docs/for-app-authors/verification
- Best Practices: https://docs.flathub.org/docs/for-app-authors/best-practices