 // ===== Global Variables for Slide Show =====
    let posts = [];
    let currentSlideIndex = 0;
    let abortSlide = false; // Flag to cancel current slide processing
    let activeInterval = null; // For the typewriter interval

    const slideTitle = document.getElementById('slideTitle2');
    const terminalDiv = document.getElementById('terminal2');
    const mediaDiv = document.getElementById('media2');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const skipBtn = document.getElementById('skipBtn');
    const sliderDiv = document.getElementById('slider2');

    // ===== Audio Player Global Variables =====
    var audioPlayer;
    let currentTrackIndex = 0;
    var tracks;

    // ===== Audio Functions =====
    function playTrack(index, src) {
      currentTrackIndex = index;
      audioPlayer.src = src;
      audioPlayer.style.display = "block";
      audioPlayer.play();
      // Highlight the currently playing track
      tracks.forEach(track => track.style.backgroundColor = "#f9f9f9");
      let current = document.getElementById(`track${index}`);
      if (current) current.style.backgroundColor = "#e0e0e0";
    }

    function stopTrack() {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      audioPlayer.style.display = "none";
      tracks.forEach(track => track.style.backgroundColor = "#f9f9f9");
    }

    // ===== Utility Functions =====
    // Typewriter function that supports aborting (returns a promise)
    function typeWriter2(element, text, speed=30) {
      return new Promise(resolve => {
        let i = 0;
        activeInterval = setInterval(() => {
          if (abortSlide) {
            clearInterval(activeInterval);
            activeInterval = null;
            resolve();
          } else {
            element.textContent += text.charAt(i);
            i++;
            if (i >= text.length) {
              clearInterval(activeInterval);
              activeInterval = null;
              resolve();
            }
          }
        }, speed);
      });
    }

    // Delay helper (returns a promise)
    function delay2(time) {
      return new Promise(resolve => {
        const timeoutId = setTimeout(() => resolve(), time);
        if (abortSlide) {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    }

    // ===== Slider Functions =====
    function createSlider() {
      sliderDiv.innerHTML = "";
      posts.forEach((post, index) => {
        const btn = document.createElement('div');
        btn.classList.add('slider-button');
        if(index === currentSlideIndex) btn.classList.add('active');
        btn.innerText = index + 1;
        btn.title = post.title;
        btn.addEventListener('click', function() {
          abortCurrentSlide();
          currentSlideIndex = index;
          displaySlide();
          updateSlider();
        });
        sliderDiv.appendChild(btn);
      });
    }

    function updateSlider() {
      const sliderButtons = document.querySelectorAll('.slider-button');
      sliderButtons.forEach((btn, index) => {
        if(index === currentSlideIndex) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // ===== Slide Processing Functions =====
    // Processes a slide by first rendering all images, then typing text
    async function processPost(post) {
      slideTitle.textContent = post.title;
      terminalDiv.textContent = "";
      mediaDiv.innerHTML = "";
      
      // Process image elements first
      let imageElements = post.elements.filter(el => el.type === 'image');
      let otherElements = post.elements.filter(el => el.type !== 'image');
      
      imageElements.forEach(el => {
        let img = document.createElement('img');
        img.src = el.src;
        img.alt = el.alt || "";
        if (el.width) {
          img.style.width = el.width + "%";
        }
        mediaDiv.appendChild(img);
      });
      
      if (imageElements.length > 0) {
        await delay2(500); // Allow images to render
      }
      
      // Now type the title and description in the terminal
      await typeWriter2(terminalDiv, post.title + "\n\n" + post.description);
      // Process remaining elements (non-images)
      await processElements(otherElements);
    }

    // Processes non-image elements gradually (typewriter/delay)
    async function processElements(elements) {
      for (let element of elements) {
        if (abortSlide) break;
        if (element.type === 'text') {
          await typeWriter2(terminalDiv, "\n" + element.content);
        } else if (element.type === 'carousel') {
          await typeWriter2(terminalDiv, "\n[Carousel content displayed below]");
          mediaDiv.appendChild(generateCarouselHTML(element.content));
          await delay2(1500);
        } else if (element.type === 'quiz') {
          await typeWriter2(terminalDiv, "\nQuiz: " + element.question);
          mediaDiv.appendChild(generateQuizElement(element));
          await delay2(3000);
        } else if (element.type === 'html') {
          let div = document.createElement('div');
          div.innerHTML = element.content;
          mediaDiv.appendChild(div);
          await delay2(1000);
        } else if (element.type === 'code') {
          mediaDiv.appendChild(generateCodeList(element.content));
          await delay2(1000);
        } else if (element.type === 'title') {
          await typeWriter2(terminalDiv, "\n" + element.content);
        } else if (element.type === 'audio') {
          mediaDiv.appendChild(generatePlaylist(element.content));
          await delay2(2000);
        }
      }
    }

    // Instantly renders a slide (used for Skip)
    function processPostInstant(post) {
      slideTitle.textContent = post.title;
      terminalDiv.textContent = post.title + "\n\n" + post.description;
      mediaDiv.innerHTML = "";
      let imageElements = post.elements.filter(el => el.type === 'image');
      let otherElements = post.elements.filter(el => el.type !== 'image');
      imageElements.forEach(el => {
        let img = document.createElement('img');
        img.src = el.src;
        img.alt = el.alt || "";
        if (el.width) {
          img.style.width = el.width + "%";
        }
        mediaDiv.appendChild(img);
      });
      otherElements.forEach(element => {
        if (element.type === 'text') {
          terminalDiv.textContent += "\n" + element.content;
        } else if (element.type === 'carousel') {
          mediaDiv.appendChild(generateCarouselHTML(element.content));
        } else if (element.type === 'quiz') {
          mediaDiv.appendChild(generateQuizElement(element));
        } else if (element.type === 'html') {
          let div = document.createElement('div');
          div.innerHTML = element.content;
          mediaDiv.appendChild(div);
        } else if (element.type === 'code') {
          mediaDiv.appendChild(generateCodeList(element.content));
        } else if (element.type === 'title') {
          terminalDiv.textContent += "\n" + element.content;
        } else if (element.type === 'audio') {
          mediaDiv.appendChild(generatePlaylist(element.content));
        }
      });
    }

    async function displaySlide() {
      abortSlide = false; // Reset abort flag for new slide
      if (currentSlideIndex < 0 || currentSlideIndex >= posts.length) return;
      await processPost(posts[currentSlideIndex]);
      updateSlider();
    }

    // Aborts current slide processing
    function abortCurrentSlide() {
      abortSlide = true;
      if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
      }
      terminalDiv.textContent = "";
      mediaDiv.innerHTML = "";
    }

    // ===== Slide Navigation =====
    function nextSlide() {
      abortCurrentSlide();
      currentSlideIndex++;
      if (currentSlideIndex >= posts.length) {
        currentSlideIndex = posts.length - 1;
      }
      updateSlider();
      displaySlide();
    }

    function prevSlide() {
      abortCurrentSlide();
      currentSlideIndex--;
      if (currentSlideIndex < 0) {
        currentSlideIndex = 0;
      }
      updateSlider();
      displaySlide();
    }

    // Skip button: Immediately render the current slide
    function skipSlide() {
      abortCurrentSlide();
      if (currentSlideIndex < 0 || currentSlideIndex >= posts.length) return;
      processPostInstant(posts[currentSlideIndex]);
    }

    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);
    skipBtn.addEventListener('click', skipSlide);

    // ===== Audio Playlist & Carousel Generation Functions =====
    function generatePlaylist(tracksData) {
      const playlistContainer = document.createElement('div');
      playlistContainer.classList.add('playlist-container');

      const playlistTitle = document.createElement('div');
      playlistTitle.classList.add('playlist-title');
      playlistTitle.textContent = 'Audio Playlist';
      playlistContainer.appendChild(playlistTitle);

      tracksData.forEach((track, index) => {
        const trackDiv = document.createElement('div');
        trackDiv.classList.add('track');
        trackDiv.id = `track${index}`;

        const trackInfo = document.createElement('div');
        trackInfo.classList.add('track-info');

        const trackTitle = document.createElement('span');
        trackTitle.textContent = `Track ${index + 1}: ${track.title}`;
        const trackDuration = document.createElement('span');
        trackDuration.textContent = track.duration || '4:00';

        trackInfo.appendChild(trackTitle);
        trackInfo.appendChild(trackDuration);
        trackDiv.appendChild(trackInfo);

        const controls = document.createElement('div');
        controls.classList.add('controls');

        const playButton = document.createElement('button');
        playButton.textContent = 'Play';
        playButton.onclick = () => playTrack(index, track.src);

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.onclick = stopTrack;

        controls.appendChild(playButton);
        controls.appendChild(stopButton);
        trackDiv.appendChild(controls);

        playlistContainer.appendChild(trackDiv);
      });

      audioPlayer = document.createElement('audio');
      audioPlayer.id = 'audioPlayer';
      audioPlayer.controls = true;
      audioPlayer.style.width = '100%';
      audioPlayer.style.display = 'none';

      currentTrackIndex = 0;
      audioPlayer.addEventListener('ended', () => {
        tracks = document.querySelectorAll('.track');
        currentTrackIndex++;
        if (currentTrackIndex < tracks.length) {
          const nextTrack = tracks[currentTrackIndex];
          const nextSrc = nextTrack.querySelector('button').getAttribute('onclick').match(/'([^']+)'/)[1];
          playTrack(currentTrackIndex, nextSrc);
        } else {
          stopTrack();
        }
      });

      playlistContainer.appendChild(audioPlayer);
      return playlistContainer;
    }

    var currentCarouselSlide = 0;
    var slidesCarousel = document.querySelectorAll('.carousel');

    function showSlideCarousel(index) {
        slidesCarousel = document.querySelectorAll('.carousel');
        slidesCarousel.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
    }

    function nextCarousel() {
        slidesCarousel = document.querySelectorAll('.carousel');
        currentCarouselSlide = (currentCarouselSlide + 1) % slidesCarousel.length;
        showSlideCarousel(currentCarouselSlide);
    }

    function prevCarousel() {
        slidesCarousel = document.querySelectorAll('.carousel');
        currentCarouselSlide = (currentCarouselSlide - 1 + slidesCarousel.length) % slidesCarousel.length;
        showSlideCarousel(currentCarouselSlide);
    }


    function generateCarouselHTML(carouselData) {
      const carouselDiv = document.createElement('div');
      carouselDiv.classList.add('carousel-box');

      const controlsDiv = document.createElement('div');
      controlsDiv.classList.add('carousel-controls');
      controlsDiv.innerHTML = '<button class="control-button" onclick="prevCarousel()">&#10094; Prev</button><button class="control-button" onclick="nextCarousel()">Next &#10095;</button>';
      carouselDiv.appendChild(controlsDiv);

      carouselData.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('carousel');
        if (index === 0) itemDiv.classList.add('active');

        if (item.image) {
          const img = document.createElement('img');
          img.src = item.image;
          img.alt = item.alt || "";
          itemDiv.appendChild(img);
        }
        if (item.video) {
          const iframe = document.createElement('iframe');
          iframe.width = "800";
          iframe.height = "450";
          iframe.src = item.video;
          iframe.title = "Video content";
          iframe.frameBorder = "0";
          iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
          iframe.allowFullscreen = true;
          itemDiv.appendChild(iframe);
        }

        const heading = document.createElement('h2');
        heading.textContent = item.name;
        itemDiv.appendChild(heading);

        const info = document.createElement('p');
        info.textContent = item.info;
        itemDiv.appendChild(info);

        carouselDiv.appendChild(itemDiv);
      });

      return carouselDiv;
    }

    function generateQuizElement(element) {
      const quizDiv = document.createElement('div');
      quizDiv.classList.add('quiz');

      const questionPara = document.createElement('p');
      questionPara.textContent = element.question;
      quizDiv.appendChild(questionPara);

      const form = document.createElement('form');
      form.classList.add('quiz-form');
      
      const radioGroupName = 'quiz_' + element.question.replace(/\s+/g, '_');
      element.options.forEach((option, index) => {
        const optionContainer = document.createElement('div');
        optionContainer.classList.add('quiz-option');

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = radioGroupName;
        radioInput.value = option;
        radioInput.id = `${radioGroupName}_${index}`;

        const label = document.createElement('label');
        label.setAttribute('for', radioInput.id);
        label.textContent = option;

        optionContainer.appendChild(radioInput);
        optionContainer.appendChild(label);
        form.appendChild(optionContainer);
      });

      const submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.textContent = 'Submit Answer';
      form.appendChild(submitButton);
      quizDiv.appendChild(form);

      const resultPara = document.createElement('p');
      resultPara.classList.add('quiz-result');
      quizDiv.appendChild(resultPara);

      submitButton.addEventListener('click', () => {
        const selectedOption = form.querySelector(`input[name="${radioGroupName}"]:checked`);
        if (!selectedOption) {
          resultPara.textContent = "Please select an answer.";
        } else if (selectedOption.value === element.correct_answer) {
          resultPara.textContent = "Correct!";
        } else {
          resultPara.textContent = "Incorrect. Try again!";
        }
      });

      return quizDiv;
    }

    function generateCodeList(fileArrayJSON) {
      const fileContainer = document.createElement('div');
      fileContainer.classList.add('file-list');
      fileContainer.innerHTML = "<h1>Snap Code Examples</h1>";
      let filesArray = [];
      if (typeof fileArrayJSON === 'string') {
        try {
          filesArray = JSON.parse(fileArrayJSON.trim());
        } catch (error) {
          console.error('Error parsing JSON in code element:', error, fileArrayJSON);
        }
      } else if (typeof fileArrayJSON === 'object') {
        filesArray = fileArrayJSON;
      }
      filesArray.forEach(file => {
        const li = document.createElement("li");
        li.className = "file-item";
        const icon = document.createElement("img");
        icon.className = "file-icon";
        icon.src = "/myProjects/codeManager/icons/xml.png";
        li.appendChild(icon);
        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.textContent = file.name;
        li.appendChild(nameSpan);
        li.addEventListener('click', (e) => {
          e.preventDefault();
          sendXMLUrlToSnap(file.url);
        });
        fileContainer.appendChild(li);
      });
      return fileContainer;
    }

    // ===== Fetch and Display Slide Data =====
    fetch('/js/blogPost.json')
      .then(response => response.json())
      .then(data => {
        posts = data.posts;
        currentSlideIndex = 0;
        displaySlide();
        createSlider();
      })
      .catch(error => console.error("Error loading JSON:", error));
