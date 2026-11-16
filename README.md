<!-- Header -->
<div align="center">
  <img src="brand/logo-rounded.png" width="200px" height="200px" />
  <h1>kube</h1>
</div>

<!-- Sheilds Section -->
<div align="center"><a href="#"><img alt="GitHub branch check runs" src="https://img.shields.io/github/check-runs/getkube/kube/main?style=for-the-badge"></a>&ensp;<a href="#"><img alt="GitHub language count" src="https://img.shields.io/github/languages/count/getkube/kube?style=for-the-badge"></a>&ensp;<a href="https://github.com/getkube/kube/issues"><img alt="GitHub Issues" src="https://img.shields.io/github/issues/getkube/kube?style=for-the-badge"></a></div>

<!-- Spacing -->
<br />

<!-- Body -->
**Kube** is a lightweight, **open-source YouTube Music client** powered by the privacy-focused **Invidious API**. Enjoy your favourite music tracking without the heavy trackers, advertisements, or resource-heavy official apps.

The React application builds for web, Android, Windows, macOS, and Linux.

- [Build and development instructions](BUILDING.md)
- [Release workflow and automatic updates](RELEASING.md)
- [Kube website](https://getkube.jamesd.uk)
- [Open the web app](https://kube.jamesd.uk)
- [Download Kube for your platform](https://github.com/getkube/kube/releases/latest)
- [Development builds](https://github.com/getkube/kube/actions/workflows/build.yml)

Release builds include update checking and downloads. Android installation requires
system confirmation; macOS automatic installation requires Apple signing credentials.

Accounts are optional. Sign up to sync your library across devices, or keep using
Kube locally as a guest. Account passwords currently have no email recovery flow.

Use the button at the bottom of the desktop sidebar to pin it open or closed.
In the player's three-dot menu, **Audio quality** selects High (the best supported
stream supplied by your Invidious instance), Normal, or Low. The setting is saved
on this device. Public streams may offer lower bitrates than YouTube Music Premium.
Playback buffers ten seconds before starting, or the full duration of a shorter
track, then keeps loading ahead. Web and desktop preloading follows the browser
engine's buffering policy; Android can buffer up to five minutes ahead.

