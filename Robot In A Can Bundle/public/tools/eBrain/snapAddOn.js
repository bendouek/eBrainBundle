
      window.addEventListener("load", function(){setTimeout(afterLoaded, 1000);});
      var executed = false;

      function fullScreenCheck() {
        if (document.fullscreenElement) return;
        document.documentElement.webkitRequestFullscreen()
        return document.documentElement.requestFullscreen();
      }

      async function rotate() {
        try {
            await fullScreenCheck();
          } catch (err) {
            console.error(err);
          }
        await screen.orientation.lock("landscape");
        world.setWidth(world.worldCanvas.width);
        world.setHeight(world.worldCanvas.height);
        world.children[0].refreshIDE();
        mobileStageSmall();
      }

      screen.orientation.addEventListener("change", () => {
        rotate();
      });

      async function mobileStageSmall(){
        if (!executed) {
            executed = true;
            world.children[0].toggleStageSize();
        }
      }

      function afterLoaded(){
        var ide = world.children.find(child => child instanceof IDE_Morph);
        Process.prototype.enableJS = true;
        ide.flatDesign();
        ide.setBlocksScale(1.2);
        ide.setPaletteWidth(235);
        // Only load library from github if NOT hosted
        if (!hasProjectPath()) {
          // Load in library from github
          fetch("../../myProjects/ebrainblocks.xml")
          .then(response => {
            if (!response.ok) {
              throw new Error('could not fetch RIAC blocks');
            }
            return response.text();
          }).then(RIAClibrary => {
            ide.droppedText(RIAClibrary, "RIAC");
            localStorage.setItem("RIAClibrary", RIAClibrary);
          }).catch(error => {
            console.log('cannot load library from file. Attempting load from cache');
            if (localStorage.getItem("RIAClibrary") !== undefined) {
              ide.droppedText(localStorage.getItem("RIAClibrary"), "RIAC");
            } else {
              alert("Cannot load RIAC library");
            }
          }).then(loadProject);
        } else {
          loadProject();
        }

        addToDemo();
      }

      window.addEventListener('message', function(event) {
        // For security, verify the origin of the message.
        // For example: if (event.origin !== 'http://expected-origin.com') return;
        
        const data = event.data;
        if (data && data.type === 'loadXML' && data.xmlURL) {
          console.log('Received XML URL:', data.xmlURL);
          // Call your Snap! function or code to load the XML file.
          // For instance, if you have a function defined in Snap!:
          loadLocalXML(data.xmlURL);
        }
      });

      function loadLocalXML(xmlUrl) {
        var ide = world.children.find(child => child instanceof IDE_Morph);
        fetch(xmlUrl, { cache: 'no-store' })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Network error: ${response.statusText}`);
            }
            return response.text();
          })
          .then(xmlText => {
            ide.droppedText(xmlText, "RIAC-xml");
            localStorage.setItem("RIACproject", xmlText);
          })
          .catch(error => {
            console.error('Failed to load XML:', error);
          });
      }

      function loadProject() {
        var ide = world.children.find(child => child instanceof IDE_Morph);
        var storedProject = localStorage.getItem("snapIDE" + autosavePath());
        if (storedProject) {
          var askTitle = SnapTranslator.language.startsWith('fr') ? "Chargez projet?" : "Load project?";
          var askContent = SnapTranslator.language.startsWith('fr') ? "Voulez-vous charger le projet sur lequel vous travailliez auparavant?" :
                                                                       "Do you want to load the project you were working on before?";
          askYesNo(askTitle, askContent, 
          function(button) {
            // Must delay autosave until after a selection is made, otherwise empty project will be auto saved.
            if (button) {
              ide.openProjectString(storedProject, startAutosave);
            } else {
              //load_project_path_if_exists(); // Attempt to load project from the iframe parameter.
              startAutosave();
            }
          });
        } else {
          //load_project_path_if_exists(); // Attempt to load project from the iframe parameter.
          startAutosave();
        }
      }

      /**
       * Start project autosave every 15 seconds.
       */
      function startAutosave() {
        var saveInterval = setInterval(function() {
            var ide = world.children[0];
            if (!ide.isRunning()) {
              var xml = ide.serializer.serialize(new Project(ide.scenes, ide.scene));
              localStorage.setItem("snapIDE" + autosavePath(), xml);
            }
        }, 15000);
      }

      function autosavePath() {
        if (hasProjectPath()) {
          var projectPath = window.frameElement.getAttribute("project_path");
          return "snapIDE" + projectPath;
        } else {
          return "snapIDE" + window.location.href;
        }
      }

      function hasProjectPath() {
        try {
         if (window.frameElement && window.frameElement.getAttribute("project_path")) {
           return true;
         } else {
           return false;
         }
        } catch (e) {
          return false;
        }
      }
      /**
       * Ask a question. When yes or no are clicked, the given
       * callback is called with the button state given as a boolean,
       * and the box is closed.
       * Pops up with a delay to ensure it actually is shown.
       */
      function askYesNo(title, message, callback) {
        let box = new DialogBoxMorph();
        // add label
        box.labelString = title;
        box.createLabel();
        // add body
        var txt = new TextMorph(message);
        txt.isBold = false;
        box['addBody'](txt); // Text should be bold to match the snap style but has to be false here, otherwise the text overflows.
        // Add methods for buttons to call
        box.yes = function() {
          box.ok(); // close the box
          callback(true);
        };
        box.no = function() {
          box.ok(); // close the box
          callback(false);
        };
        box.addButton('yes', 'Yes'); // This button triggers the 'yes' function
        box.addButton('no', 'No'); // This button triggers the 'no' function
        box.fixLayout(); // required
        setTimeout(function() {box.popUp(world)}, 400);
      }
      
      function addToDemo() {
        var h, b, c, ci, cb, cm, cd, co, cl, cu, cs, cmd, rings, rc, scripts;
        // SyntaxElementMorph.prototype.setScale(2.5);

        h = new HatBlockMorph();
        h.setSpec('When %greenflag pressed');

        b = new ReporterBlockMorph(true);
        b.setSpec('%bool');

        c = new CommandBlockMorph();
        c.setSpec('this is a test $globe');

        ci = new CommandBlockMorph();
        ci.setSpec('block with input %s unit %mult%n number');

        cb = new CommandBlockMorph();
        cb.setSpec('bool %b ?');

        cd = new CommandBlockMorph();
        cd.setSpec('direction %dir degrees');

        co = new CommandBlockMorph();
        co.setSpec('object %obj');

        cl = new CommandBlockMorph();
        cl.setSpec('list %l');

        cu = new CommandBlockMorph();
        cu.setSpec('list %upvar');

        cs = new CommandBlockMorph();
        cs.setSpec('control %b %ca');

        cmd = new CommandBlockMorph();
        cmd.setSpec('command %cmdRing');

        rings = new CommandBlockMorph();
        rings.setSpec('reporter %repRing predicate %predRing');

        rc = new ReporterBlockMorph();
        rc.setSpec('color %clr');

        scripts = new ScriptsMorph();

        BlockMorph.prototype.addToDemoMenu([
          'Syntax',
          [
            [h, 'hat'],
            [b, 'predicate'],
            [c, 'with label text'],
            [ci, 'editable input slots'],
            [cb, 'Boolean slot'],
            //[cm, 'menu input'],
            [cd, 'direction input'],
            [co, 'object input'],
            [cl, 'list input'],
            [cu, 'upvar input'],
            [cs, 'loop input'],
            [cmd, 'cmd ring input'],
            [rings, 'reporter rings input'],
            [rc, 'color input'],
            [scripts, 'scripts']
          ]
        ]);
      }