$(document).foundation();

var pjson = require('./package.json');

// VARIABLES
var appVersion = pjson.version;
var page = document.getElementsByTagName("BODY")[0];
var codeOut = document.getElementById('codeOut');
var canvas = document.getElementById('svgCanvas');
var dragArea = document.getElementById('dragArea');
var btnSave = document.getElementById('saveButton');
var modalert = document.getElementById('modalert');
var g = canvas.g = canvas.getContext('2d');
var images = [];
var reader = new FileReader();
var gCodeOutput = "";
var jsCodeOutput = "";
var areaWidth = 250;
var areaHeight = 210;
var viewWidth = areaWidth;
var viewHeight = areaHeight;
var svgW = 0;
var svgH = 0;
var startScript = "";
var endingScript = "";
var backingStoreRatio = g.webkitBackingStorePixelRatio || g.mozBackingStorePixelRatio || g.msBackingStorePixelRatio || g.oBackingStorePixelRatio || g.backingStorePixelRatio || 1;
var ratio = (window.devicePixelRatio || 1) / backingStoreRatio;
var modelCache = null;
var fileCache = null;
var recentlyModified = false;

var fillsAllowed = false;
// var skipzhome = false; // Allow skip Z height and home
var laserHeight = 50; // Height of laser (mm)
var moveSpeed = 5400; // Traveling speed (mm/minute)
var laserSpeed = 300; // Etching speed (mm/minute)(higher = lighter)
var laserValue = 255; // Laser intensity (0-255)
var interpolationPoints = 50; // min:40
var toolDiam = 0.5; // in mm -


// HELPER FUNCTIONS
function returnFileSize(number) {
  if(number < 1024) {
    return number + 'bytes';
  } else if(number > 1024 && number < 1048576) {
    return (number/1024).toFixed(1) + 'KB';
  } else if(number > 1048576) {
    return (number/1048576).toFixed(1) + 'MB';
  }
}

String.prototype.replaceAll = function(str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}


// LOAD FILE
function resetLoad() {
  fileCache=null;
  $('#reloadButton').addClass("allowed");
}
function loadFile() {
  recentlyModified = false;
  checkRecentlyModified();
  gCodeOutput = "";
  if (fileCache != null){
    var file = fileCache;
  } else {
    var file = document.querySelector('input[type=file]').files[0];
    fileCache = file;
  }
  var reader  = new FileReader();
  images = [];
  reader.addEventListener("load", function (e) {
    var dataURL = e.target.result;
    var imgEL = new Image();
    imgEL.name = name;
    imgEL.onload = function (e) {
        var image = e.target;
        image.name = name;
        images.push(image);
        codeOut.value = '';
        images[0].width=image.width;
        images[0].height=image.height;
        canvgSVGprocess(images[0], 0, 0);
    }
    imgEL.src = dataURL;
  }, false);

  //load SVG as XML to get precise width and height
  $.get(file.path, null, function(data){
        var svgNode = $("svg", data);
        svgW = svgNode[0].width.baseVal.value;
        svgH = svgNode[0].height.baseVal.value;
    }, 'xml');

  if (file) { reader.readAsDataURL(file); }

  document.title = pjson.name+" — "+file.name;
  file = {};
  reader = {};
  document.querySelector('input[type=file]').value = "";
}

function reloadFile() {
  loadFile();
}

function clearAll() {
  location.reload();
}

function addZero(num) {
  var zeroed = "";
  if (num < 10) { zeroed = "0"+num; } else { zeroed = num; }
  return zeroed;
}

function getPrintInfo() {
  var modelInfo = GCODE.gCodeReader.getModelInfo();
  var totaltime = modelInfo.printTime * 0.9; // 1.2 = +20% conservative estimate
  var h = parseInt(parseFloat(totaltime)/60/60);
  var m = addZero(Math.ceil((parseFloat(totaltime)/60)%60));
  var s = addZero(Math.ceil(parseFloat(totaltime)%60));
  $("#printInfo").html("Estimated engraving time — <span class='num'>"+ h + ":" + m + ":" + s +"</span>");
}

function closeProcessingDialog() {
  $('#processingDialog').foundation('close');
  getPrintInfo();
  //console.log("Done")
}

// JS -> GCODE
function convert(fn) {
  var ctx = document.getElementsByClassName('svgCanvas')[0].getContext('2d');
  var simtarget = document.getElementsByClassName('simCanvas')[0].getContext('2d');
  simtarget.clearRect(0, 0, viewWidth, viewHeight);
  var simdriver = new GCanvas.Simulator(simtarget);
  var simctx = new GCanvas(simdriver);
  var gcodectx = new GCanvas(null);

  gcodectx.toolDiameter = toolDiam;
  gcodectx.interpolationPoints = interpolationPoints;

  simctx.toolDiameter = toolDiam;
  ctx.toolDiameter = toolDiam;

  //GCode output
  codeOut.value = "";
  gcodectx.driver.stream.write = function(cmd) {
    //codeOut.value += cmd+'\n';
    gCodeOutput += cmd+'\n';
  };

  //fn(ctx); // Draw real
  //fn(simctx); // Draw simulation
  fn(gcodectx); // Output Gcode

  //console.log('Done: JS > GCODE');

  startScript += ";LARIBO v"+appVersion+"\n";
  startScript += ";Burn value: "+laserValue+"\n";
  startScript += ";Burn speed: "+laserSpeed+" mm/min\n";
  startScript += ";Move speed: "+moveSpeed+" mm/min\n";
  startScript += ";Laser height: "+laserHeight+" mm\n";
  startScript += ";Curve resolution: "+interpolationPoints+" divisions\n";
  startScript += ";Fills allowed: "+fillsAllowed+"\n";
  if(fillsAllowed) endingScript += ";Fill density: "+toolDiam+" mm\n";
  startScript += ";\n";

  startScript += "M104 S0 ; Extruder temp=0\n";
  startScript += "M140 S0 ; Heatbed  temp=0\n";
  startScript += "G28 W   ; Home all axis\n";
  startScript += "G0 X0 Y0 Z100 F"+moveSpeed+" ; Go to home and raise\n";
  startScript += "M5      ; Laser OFF\n";
  startScript += "M117 Load\n";
  startScript += "M1      ; Pause\n" // Pause to let work piece get placed onto bed
  startScript += "G0 Z"+laserHeight+" ; Go to focused height\n";
  startScript += "; LAYER:1\n"

  endingScript += "M400   ; Wait for all movements\n";
  endingScript += "M5     ; Laser OFF\n";
  endingScript += "G0 X0 Y210 Z100 F"+moveSpeed+"\n"; // Move build area to front

  prusifyGcode(gCodeOutput); // Add PRUSA specific mods
  //setTimeout(function(){prusifyGcode(gCodeOutput);}, 500);
}

function test(ctx) {
  ctx.arc(100, 100, 90, 0, Math.PI*2, true);
  ctx.fill('nonzero');
}
//convert(test); //TEST function

// SVG -> JS
function setSize(width, height, canvas) {
    canvas = canvas || window.canvas;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}
setSize(viewWidth,viewHeight,canvas);
setSize(viewWidth,viewHeight,simCanvas);

function canvgSVGprocess(img, x, y) {
  var tempCanvas = document.createElement('canvas');
  tempCanvas.id = "tempCanvas";
  tempCanvas.name = img.name;
  tempCanvas.x = x;
  tempCanvas.y = y;
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  tempCanvas.style.zIndex = -1;
  tempCanvas.style.visibility = 'hidden'
  page.appendChild(tempCanvas);
  canvg(tempCanvas, atob(img.src.substring('data:image/svg+xml;base64,'.length)), {
      ignoreMouse: true,
      ignoreAnimation: true,
      ignoreDimensions: true,
      ignoreClear: true,
      //scaleWidth: areaWidth//img.width,
      scaleWidth:areaWidth,
      scaleHeight:-areaHeight,
      offsetX:0,
      offsetY:-svgH//-354.330719
  });
  tempCanvas.remove();
}

function drawCanvas() {
  g.clearRect(0, 0, canvas.parentNode.clientWidth, canvas.parentNode.clientHeight);
  g.save();
  g.scale(ratio, ratio);
  g.drawImage(this, this.x, this.y);
  g.restore();
  this.parentNode.removeChild(this);
}

// Conversion /////////////////////////
window.onSVGDraw = function (code, canvas) {

  //console.log("Draw");
  //setTimeout(drawCanvas.bind(canvas), 5); //Draw actual svg

  if (fillsAllowed != false) {
    jsCodeOutput = code;
  } else {
    code = code.replaceAll('\nctx.fill();','');
    code = code.replaceAll('\nctx.fill("evenodd");','');
    code = code.replaceAll('\nctx.fill("nonzero");','');
    jsCodeOutput = code;
  }

  //console.log('Done: SVG > JS');

  function jsOut (ctx){
    ctx.globalAlpha = 1;
    ctx.toolDiameter = toolDiam;
    eval(jsCodeOutput);
  }

  $('#processingDialog P').html("Converting SVG");
  $('#processingDialog').foundation('open');// open processing message - close after draw is done (renderer.js)

  setTimeout(function(){convert(jsOut);}, 500);

}

// PRUSAFICATION
function prusifyGcode (code) {
  var lines = code.split("\n");
  var line = "";
  var output = "";
  var total = lines.length;
  var laserExtrusion = 0;
  var laserInc = 0.002;
  var alphaVal = 0;
  var alphaOne = 0;
  var firstG0 = true;

  $('#processingDialog P').html("Processing <strong class='num'>"+total+"</strong> instructions...");

  // Start Loop
  for ( var i = 0; i < total; i++ ) {
    line = lines[i];

    //Detect alpha change
    if (line.indexOf("A")==0){
      alphaOne = line.substring(1,line.length);
      alphaVal = parseInt(laserValue * parseFloat(alphaOne));
      line = ";;;" + line + " - " + alphaVal;
    }
    //G0
    if (line.indexOf("G0")==0){
      // Only if X and Y values are present
      if(line.indexOf(" X")!=-1 && line.indexOf(" Y")!=-1) {
        line = "M5; Laser OFF\n" + line; //Add laser off before G0 line
        line = "M400; Wait for all move commands to finish\n" + line
      }
      // Add movement speed to all G0s, unless already defined or has Z (should stay default)
      if(line.indexOf(" F")==-1 && line.indexOf(" Z")==-1) {
        line += " F" + moveSpeed;
      }
      if(firstG0){
        line += " E0";
        firstG0 = false;
      }
    }
    //G1
    if (line.indexOf("G1")==0) {
      // Remove Z values from G1s
      if(line.indexOf(" Z")!=-1) {
        var findZee = /\b\sZ.?[^\s]+/;
        line = line.replace(findZee,"");
      };
      // Only if X or Y or Z are present
      if(line.indexOf(" Z")!=-1 || line.indexOf(" X")!=-1 || line.indexOf(" Y")!=-1) {
        // Only if not already E
        if(line.indexOf(" E")==-1){
          // Needed for gcode viewer bug - only works if there's extrusion
          if(laserExtrusion==0) { laserExtrusion = laserInc } else { laserExtrusion += laserInc }
          line += " E" + laserExtrusion.toFixed(3);
          line += " P" + alphaOne;
          //Laser power values dependent on element opacity
          if (alphaVal == 0) alphaVal = 1;
          line = "M3 S"+ alphaVal +"; Laser ON\n" + line; //Laser ON!
          line = "M400; Wait for all move commands to finish\n" + line
        }
      }
      // Add feed speed
      if(line.indexOf(" F")==-1) {
        line += " F" + laserSpeed;
      }
    }
    //Write updated line, ignore empty lines
    if(line!="") output += line+"\n";//console.log(line);

  } // End Loop

  gCodeOutput = startScript + output + endingScript; // Add start+end scripts
  startScript = "";
  endingScript = "";

  //codeOut.value = gCodeOutput;
  loadIntoViewer(gCodeOutput);

  // $('#progressDialog').foundation('close');
}

// Remove all extrusions (viewer bug remedy)
cleanGCode = function(){
  var lines = gCodeOutput.split("\n");
  var line = "";
  var output = "";
  var total = lines.length;

  $('#processingDialog P').html("Processed <strong class='num'>"+total+"</strong> instructions. Cleaning up.");

  for ( var i = 0; i < total; i++ ) {
    line = lines[i];
    if(line.indexOf(" E")!==-1){
      var findE = /\b\sE.?[^\s]+/;
      line = line.replace(findE,"");
    };
    if(line.indexOf(" P")!==-1){
      var findP = /\b\sP.?[^\s]+/;
      line = line.replace(findP,"");
    };
    if(line.indexOf(";;;A")!==-1){
      line = ""; //Delete Alpha helpers
    };
    if(line!="") output += line+"\n";
  }
  gCodeOutput = output;
  //codeOut.value = output;//DEBUG
  //closeProcessingDialog();
}

// VIEWER TEST
loadTest = function(){
  //var gcode = "M629 C0\nM104 S0\nM140 S0\nG28\nG0 Z105\nG0 X0 Y0 F5400\nG92 E0\nG1 X0.0001 Y0.0001 E0.0 F400\nG0 X60 Y92.32995 F5400\nG1 X63.38624 Y85.45018 E0.010 F400\nG1 X70.97002 Y84.35648 E0.020 F400\nG1 X65.50265 Y78.99379 E0.030 F400\nG1 X66.77249 Y71.44369 E0.040 F400\nG1 X60 Y75.00706 E0.050 F400\nG1 X53.22751 Y71.44369 E0.060 F400\nG1 X54.49735 Y78.99379 E0.070 F400\nG1 X49.02998 Y84.35648 E0.080 F400\nG1 X56.61376 Y85.45018 E0.090 F400\nG1 X60 Y92.32995 E0.100 F400\nG28 XY\nG0 Y125 F540\n";
  var gcode = "M104 S0\nM140 S0\nG28 W\nG0 Z50\nG0 X0 Y0 F1200\nM106 S0\nM1\n;;;A0.37 - 94\nM106 S0\nG0 X121.46446 Y87.322332 F1200 E0\nM106 S94\nG1 X128.535529 Y94.393401 E0.002 P0.37 F300\n;;;A1 - 255\n;;;A0.09 - 22\nM106 S22\nG1 X125 Y97.92893 E0.004 P0.09 F300\nM106 S22\nG1 X121.464471 Y101.46446 E0.006 P0.09 F300\n;;;A1 - 255\nM106 S255\nG1 X128.53554 Y108.535529 E0.008 P1 F300\n;;;A1 - 255\n;;;A0.19 - 48\nM106 S48\nG1 X121.464471 Y115.606599 E0.010 P0.19 F300\n;;;A1 - 255\nM106 S255\nG1 X128.53554 Y122.677668 E0.012 P1 F300\n;;;A1 - 255\nM106 S0\nG0 Y210 F1200\n;LARIBO v1.1.0\n;Burn value: 255\n;Burn speed: 300 mm/min\n;Move speed: 1200 mm/min\n;Laser height: 50 mm\n;Curve resolution: 50 divisions\n;Fills allowed: false\n"
  var target = {result:gcode};
  var file = {target:target};
  GCODE.gCodeReader.loadFile(file);
  delete file;
}

loadIntoViewer = function(gcode){ // gcode is a string!
  var target = {result:gcode};
  var file = {target:target};
  GCODE.gCodeReader.loadFile(file);
  delete file;
  cleanGCode();
}

// SETTINGS SWITCHES
  // Fill toggle switch
  $("#fillSwitch").change(function() {
    if(this.checked) {
        // console.log("Settings / Fills : ON");
        fillsAllowed = true;
    } else {
        // console.log("Settings / Fills : OFF");
        fillsAllowed = false;
    };
    recentlyModified = true;
    checkRecentlyModified();
  });

  //Z skip switch - not working
  $("#skipZSwitch").change(function() {
    if(this.checked) {
        skipzhome = true;
        console.log("Settings / Skip Z : YES");
    } else {
        skipzhome = false;
        console.log("Settings / Skip Z : NO");
    }
  });

//Disallow Save if recently modified
checkRecentlyModified = function(){
  if (recentlyModified && fileCache!=null) {
    // btnSave.classList.add("disabled");
    // btnSave.style.pointerEvents = "none";
    modalert.classList.remove("hide");
  } else {
    // btnSave.classList.remove("disabled");
    // btnSave.style.pointerEvents = "auto";
    modalert.classList.add("hide");
  }
}

//SETTINGS SLIDERS
  // Tool diameter slider
  $('#toolDiameterOutput').on('moved.zf.slider', function(){
    var val = $(this).children('.slider-handle').attr('aria-valuenow');
    //var output = (val*.01).toFixed(2);
    //$('#toolDiameterOutputNum').val(output);
    toolDiam = val;
    recentlyModified = true;
    checkRecentlyModified();
  });

  // Laser height slider
  $('#sliderHeightAdjust').on('moved.zf.slider', function(){
    var val = $(this).children('.slider-handle').attr('aria-valuenow');
    //$('#sliderHeightAdjustNum').val(val);
    laserHeight = val;
    recentlyModified = true;
    checkRecentlyModified();
  });

  // Movement speed slider
  $('#sliderMoveSpeedAdjust').on('moved.zf.slider', function(){
    var val = $(this).children('.slider-handle').attr('aria-valuenow');
    //$('#sliderMoveSpeedAdjustNum').val(val);
    moveSpeed = val;
    recentlyModified = true;
    checkRecentlyModified();
  });

  // Laser burn speed slider
  $('#sliderBurnSpeedAdjust').on('moved.zf.slider', function(){
    var val = $(this).children('.slider-handle').attr('aria-valuenow');
    //$('#sliderBurnSpeedAdjustNum').val(val);
    laserSpeed = val;
    var laserValue = 255; // Laser intensity (0-255)
    recentlyModified = true;
    checkRecentlyModified();
  });

  // Laser burn value slider
  $('#sliderBurnValueAdjust').on('moved.zf.slider', function(){
    var val = $(this).children('.slider-handle').attr('aria-valuenow');
    //$('#sliderBurnSpeedAdjustNum').val(val);
    laserValue = val;
    recentlyModified = true;
    checkRecentlyModified();
  });

  // Curve interpolation slider
  $('#sliderResolutionAdjust').on('moved.zf.slider', function(){
    var val = $(this).children('.slider-handle').attr('aria-valuenow');
    //$('#sliderResolutionAdjustNum').val(val);
    interpolationPoints = val;
    recentlyModified = true;
    checkRecentlyModified();
  });

window.onload = function() {
  $("#versionInfo").html("v"+appVersion);
}
