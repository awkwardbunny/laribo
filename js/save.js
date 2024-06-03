'use strict';

const fs = require('fs');
const {dialog} = require('@electron/remote');

document.addEventListener('DOMContentLoaded', () => {
  const btnSave = document.getElementById('saveButton');
  btnSave.addEventListener('click', () => {
    if (gCodeOutput === "") {
      dialog.showMessageBox({
        title: 'Save Gcode',
        message: 'Nothing to save just yet...',
        detail: 'Load a 250 x 210 (mm) SVG file to get started.',
        buttons: ['OK']
      });
    } else {
      dialog.showSaveDialog({
        filters: [{
          name: 'Gcode',
          extensions: ['gcode']
        }]
      }).then((save) => {
        if (save.canceled) return;
        fs.writeFile(save.filePath, gCodeOutput, (err) => {
          if (err === undefined || err == null) {
            dialog.showMessageBox({
              title: 'Gcode saved successfully',
              message: 'Save completed',
              detail: 'Remeber to always wear your safety goggles while the laser is on!',
              buttons: ['OK']
            });
          } else {
            dialog.showErrorBox('File save error', err.message);
          }
        });
      });
    }
  });
});