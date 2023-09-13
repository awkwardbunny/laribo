# Laribo

Website: https://vandenmar.com/laribo/

Instructable: https://www.instructables.com/Laser-Engraving-on-Your-Prusa-MK3/

Powered by - nodejs, electron, GCanvas, canvg, gCodeViewer, foundation, foundation-icons, jQuery, jQueryUI


## Electron packager commands

* **Win 64 only:**
  ```console
  electron-packager ~/Git/laribo/ Laribo --icon ~/Git/laribo/img/app --platform win32 --arch x64 --out ~/Git/laribo/compiled/ --overwrite --asar --ignore backup
  ```
* **Win+Linux:**
  ```console
  electron-packager ~/Git/laribo/ Laribo --icon ~/Git/laribo/img/app --platform win32,linux --arch all --out ~/Git/laribo/compiled/ --overwrite --asar --ignore backup
  ```

* **Mac:**
  ```console
  electron-packager ~/Git/laribo/ Laribo --icon ~/Git/laribo/img/app --platform darwin,mas --out ~/Git/laribo/compiled/ --overwrite --asar --ignore backup
  ```

* **All:**
  ```console
  electron-packager ~/Git/laribo/ Laribo --icon ~/Git/laribo/img/app --platform darwin,win32,linux,mas --arch all --out ~/Git/laribo/compiled/ --overwrite --asar --ignore backup
  ```

* **Darwin + Win64 only:**
  ```console
  electron-packager ~/Git/laribo/ Laribo --icon ~/Git/laribo/img/app --platform darwin,win32 --arch x64 --out ~/Git/laribo/compiled/ --overwrite --asar --ignore backup
  ```
