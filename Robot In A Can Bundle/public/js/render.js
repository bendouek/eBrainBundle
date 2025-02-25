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

// ===== DSL Parser Helper Functions =====

// Parse an IMAGE line (used both inside [CODE] and as a standalone element)
function parseImageLine(line) {
  // Expected format: IMAGE: "url",width, "alt text"
  const content = line.substring("IMAGE:".length).trim();
  const parts = content.split(",");
  if (parts.length < 3) {
    throw new Error("Invalid IMAGE format. Expected: IMAGE: \"url\",width, \"alt text\"");
  }
  const src = parts[0].trim().replace(/^"|"$/g, '');
  const width = parseInt(parts[1].trim(), 10);
  const alt = parts[2].trim().replace(/^"|"$/g, '');
  return { type: 'image', src, width, alt };
}

// Parse a carousel slide line inside a [CAROUSEL] block
function parseCarouselSlideLine(content) {
  // Expected format: "images/slide1.jpg","alt","Image title","image description"
  const parts = content.split(",");
  if (parts.length < 4) {
    throw new Error("Invalid SLIDE format in CAROUSEL. Expected: \"url\",\"alt\",\"Image title\",\"image description\"");
  }
  const image = parts[0].trim().replace(/^"|"$/g, '');
  const alt = parts[1].trim().replace(/^"|"$/g, '');
  const title = parts[2].trim().replace(/^"|"$/g, '');
  const description = parts[3].trim().replace(/^"|"$/g, '');
  return { image, alt, title, description };
}

// Main DSL parser: converts the DSL text into an array of slide objects
function parseDSL(dslText) {
  const lines = dslText.split("\n");
  const slides = [];
  let currentSlide = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith("===")) {
      // Toggle slide boundaries: start or end
      if (!currentSlide) {
        // Start a new slide; text after "===" is the slide's id
        const id = line.substring(3).trim();
        currentSlide = { id: id, title: "", text: "", elements: [] };
      } else {
        // End of the current slide; push it and reset
        slides.push(currentSlide);
        currentSlide = null;
      }
    } else if (currentSlide) {
      if (line.startsWith("TITLE:")) {
        currentSlide.title = line.substring("TITLE:".length).trim();
      } else if (line.startsWith("TEXT:")) {
        let dialogueLine = line.substring("TEXT:".length).trim();
        // Append multiple DIALOGUE lines with a newline separator
        currentSlide.dialogue = currentSlide.dialogue ? currentSlide.dialogue + "\n" + dialogueLine : dialogueLine;
      } else if (line.startsWith("IMAGE:")) {
        // Standalone image element
        const imageElement = parseImageLine(line);
        currentSlide.elements.push(imageElement);
      } else if (line.startsWith("[CAROUSEL]")) {
        const carouselItems = [];
        i++; // Advance to content inside the block
        while (i < lines.length && !lines[i].trim().startsWith("[/CAROUSEL]")) {
          let carouselLine = lines[i].trim();
          if (carouselLine.startsWith("- SLIDE:")) {
            const content = carouselLine.substring("- SLIDE:".length).trim();
            const slideObj = parseCarouselSlideLine(content);
            carouselItems.push(slideObj);
          }
          i++;
        }
        currentSlide.elements.push({ type: 'carousel', items: carouselItems });
      } else if (line.startsWith("[QUIZ]")) {
        const quiz = { type: 'quiz' };
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("[/QUIZ]")) {
          let quizLine = lines[i].trim();
          if (quizLine.startsWith("QUESTION:")) {
            quiz.question = quizLine.substring("QUESTION:".length).trim().replace(/^"|"$/g, '');
          } else if (quizLine.startsWith("OPTIONS:")) {
            let opts = quizLine.substring("OPTIONS:".length).trim();
            quiz.options = opts.split(",").map(s => s.trim().replace(/^"|"$/g, ''));
          } else if (quizLine.startsWith("ANSWER:")) {
            quiz.answer = quizLine.substring("ANSWER:".length).trim().replace(/^"|"$/g, '');
          }
          i++;
        }
        currentSlide.elements.push(quiz);
      } else if (line.startsWith("[CODE]")) {
        const code = { type: 'code' };
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("[/CODE]")) {
          let codeLine = lines[i].trim();
          if (codeLine.startsWith("IMAGE:")) {
            code.image = parseImageLine(codeLine);
          } else if (codeLine.startsWith("DESCRIPTION:")) {
            code.description = codeLine.substring("DESCRIPTION:".length).trim().replace(/^"|"$/g, '');
          } else if (codeLine.startsWith("XMLURL:")) {
            code.xmlUrl = codeLine.substring("XMLURL:".length).trim().replace(/^"|"$/g, '');
          }
          i++;
        }
        currentSlide.elements.push(code);
      } else if (line.startsWith("[IFRAME]")) {
        const iframe = { type: 'iframe' };
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("[/IFRAME]")) {
          let iframeLine = lines[i].trim();
          if (iframeLine.startsWith("SRC:")) {
            iframe.src = iframeLine.substring("SRC:".length).trim().replace(/^"|"$/g, '');
          } else if (iframeLine.startsWith("CROP:")) {
            // Expected format: CROP: x=100, y=50, width=600, height=400
            let cropText = iframeLine.substring("CROP:".length).trim();
            const cropParams = {};
            cropText.split(",").forEach(part => {
              let [key, value] = part.split("=");
              if (key && value) {
                cropParams[key.trim()] = parseInt(value.trim(), 10);
              }
            });
            iframe.crop = cropParams;
          } else if (iframeLine.startsWith("DESCRIPTION:")) {
            iframe.description = iframeLine.substring("DESCRIPTION:".length).trim().replace(/^"|"$/g, '');
          }
          i++;
        }
        currentSlide.elements.push(iframe);
      }
    }
  }
  return slides;
}

// ===== Utility Functions =====

// Typewriter effect (supports aborting)
function typeWriter2(element, text, speed = 30) {
  return new Promise(resolve => {
    let i = 0;
    activeInterval = setInterval(() => {
      if (abortSlide) {
        clearInterval(activeInterval);
        activeInterval = null;
        nextBtn.disabled = false;
        resolve();
      } else {
        element.textContent += text.charAt(i);
        i++;
        nextBtn.disabled = true;
        if (i >= text.length) {
          clearInterval(activeInterval);
          activeInterval = null;
          nextBtn.disabled = false;
          resolve();
        }
      }
    }, speed);
  });
  nextBtn.disabled = false;
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

// ===== Slide Processing Functions =====

async function processPost(post) {
  slideTitle.textContent = post.title;
  terminalDiv.textContent = "";
  mediaDiv.innerHTML = "";

  // Process standalone IMAGE elements first
  let imageElements = post.elements.filter(el => el.type === 'image');
  imageElements.forEach(el => {
    const img = document.createElement('img');
    img.src = el.src;
    img.alt = el.alt || "";
    if (el.width) {
      img.style.width = el.width + "%";
    }
    mediaDiv.appendChild(img);
  });
  
  if (imageElements.length > 0) {
    await delay2(500);
  }
  
  // Type the dialogue text in the terminal
  await typeWriter2(terminalDiv, post.dialogue);
  
  // Process other elements (carousel, quiz, code, iframe)
  await processElements(post.elements.filter(el => el.type !== 'image'));
}

async function processElements(elements) {
  for (let element of elements) {
    if (abortSlide) break;
    if (element.type === 'carousel') {
      await typeWriter2(terminalDiv, "\n[Carousel content displayed above]");
      mediaDiv.appendChild(generateCarouselHTML(element.items));
      await delay2(1500);
    } else if (element.type === 'quiz') {
      await typeWriter2(terminalDiv, "\nQuiz: " + element.question);
      mediaDiv.appendChild(generateQuizElement(element));
      await delay2(3000);
    } else if (element.type === 'code') {
      // Render the code element as an image that, when clicked, loads the XML URL.
      const codeImg = document.createElement('img');
      codeImg.src = element.image.src;
      codeImg.alt = element.image.alt;
      if (element.image.width) {
        codeImg.style.width = element.image.width + "%";
      }
      codeImg.style.cursor = "pointer";
      codeImg.addEventListener('click', () => {
        sendXMLUrlToSnap(element.xmlUrl);
      });
      mediaDiv.appendChild(codeImg);
      if (element.description) {
        const desc = document.createElement('p');
        desc.textContent = element.description;
        mediaDiv.appendChild(desc);
      }
      await delay2(1000);
    } else if (element.type === 'iframe') {
      const iframeContainer = document.createElement('div');
      iframeContainer.style.position = 'relative';
      iframeContainer.style.overflow = 'hidden';
      iframeContainer.style.width = element.crop.width + "px";
      iframeContainer.style.height = element.crop.height + "px";
      
      const iframeEl = document.createElement('iframe');
      iframeEl.src = element.src;
      iframeEl.style.border = "none";
      iframeEl.style.position = 'absolute';
      iframeEl.style.left = -element.crop.x + "px";
      iframeEl.style.top = -element.crop.y + "px";
      iframeEl.style.width = "100%";
      iframeEl.style.height = "100%";
      iframeContainer.appendChild(iframeEl);
      
      mediaDiv.appendChild(iframeContainer);
      if (element.description) {
        const desc = document.createElement('p');
        desc.textContent = element.description;
        mediaDiv.appendChild(desc);
      }
      await delay2(1000);
    }
  }
}

// Immediately render a slide (used for Skip)
function processPostInstant(post) {
  slideTitle.textContent = post.title;
  terminalDiv.textContent = post.dialogue;
  mediaDiv.innerHTML = "";
  // Render standalone images
  post.elements.filter(el => el.type === 'image').forEach(el => {
    const img = document.createElement('img');
    img.src = el.src;
    img.alt = el.alt || "";
    if (el.width) {
      img.style.width = el.width + "%";
    }
    mediaDiv.appendChild(img);
  });
  // Render other elements instantly
  post.elements.filter(el => el.type !== 'image').forEach(element => {
    if (element.type === 'carousel') {
      mediaDiv.appendChild(generateCarouselHTML(element.items));
    } else if (element.type === 'quiz') {
      mediaDiv.appendChild(generateQuizElement(element));
    } else if (element.type === 'code') {
      const codeImg = document.createElement('img');
      codeImg.src = element.image.src;
      codeImg.alt = element.image.alt;
      if (element.image.width) {
        codeImg.style.width = element.image.width + "%";
      }
      codeImg.style.cursor = "pointer";
      codeImg.addEventListener('click', () => {
        sendXMLUrlToSnap(element.xmlUrl);
      });
      mediaDiv.appendChild(codeImg);
      if (element.description) {
        const desc = document.createElement('p');
        desc.textContent = element.description;
        mediaDiv.appendChild(desc);
      }
    } else if (element.type === 'iframe') {
      const iframeContainer = document.createElement('div');
      iframeContainer.style.position = 'relative';
      iframeContainer.style.overflow = 'hidden';
      iframeContainer.style.width = element.crop.width + "px";
      iframeContainer.style.height = element.crop.height + "px";
      
      const iframeEl = document.createElement('iframe');
      iframeEl.src = element.src;
      iframeEl.style.border = "none";
      iframeEl.style.position = 'absolute';
      iframeEl.style.left = -element.crop.x + "px";
      iframeEl.style.top = -element.crop.y + "px";
      iframeEl.style.width = "100%";
      iframeEl.style.height = "100%";
      iframeContainer.appendChild(iframeEl);
      
      mediaDiv.appendChild(iframeContainer);
      if (element.description) {
        const desc = document.createElement('p');
        desc.textContent = element.description;
        mediaDiv.appendChild(desc);
      }
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
  nextBtn.disabled = false;
  terminalDiv.textContent = "";
  mediaDiv.innerHTML = "";
}

// ===== Slide Navigation =====
function createSlider() {
  sliderDiv.innerHTML = "";
  posts.forEach((post, index) => {
    const btn = document.createElement('div');
    btn.classList.add('slider-button');
    if (index === currentSlideIndex) btn.classList.add('active');
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
    if (index === currentSlideIndex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

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

// ===== (Placeholder) Generation Functions for Carousel and Quiz =====

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

function generateCarouselHTML(items) {
  const carouselDiv = document.createElement('div');
  carouselDiv.classList.add('carousel-box');
  
  // Simple controls (for illustration)
  const controlsDiv = document.createElement('div');
  controlsDiv.classList.add('carousel-controls');
  controlsDiv.innerHTML = '<button class="control-button" onclick="prevCarousel()">&#10094; Prev</button><button class="control-button" onclick="nextCarousel()">Next &#10095;</button>';
  carouselDiv.appendChild(controlsDiv);
  
  items.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('carousel');
    if (index === 0) itemDiv.classList.add('active');
    
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.alt || "";
    itemDiv.appendChild(img);
    
    const heading = document.createElement('h2');
    heading.textContent = item.title;
    itemDiv.appendChild(heading);
    
    const info = document.createElement('p');
    info.textContent = item.description;
    itemDiv.appendChild(info);
    
    carouselDiv.appendChild(itemDiv);
  });
  return carouselDiv;
}

function generateQuizElement(quiz) {
  const quizDiv = document.createElement('div');
  quizDiv.classList.add('quiz');
  
  const questionPara = document.createElement('p');
  questionPara.textContent = quiz.question;
  quizDiv.appendChild(questionPara);
  
  const form = document.createElement('form');
  form.classList.add('quiz-form');
  
  const radioGroupName = 'quiz_' + quiz.question.replace(/\s+/g, '_');
  quiz.options.forEach((option, index) => {
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
  submitButton.classList.add('btn');
  submitButton.textContent = 'Submit Answer';
  form.appendChild(document.createElement('br'));
  form.appendChild(submitButton);
  quizDiv.appendChild(form);
  
  const resultPara = document.createElement('h2');
  resultPara.classList.add('quiz-result');
  quizDiv.appendChild(resultPara);
  
  submitButton.addEventListener('click', () => {
    const selectedOption = form.querySelector(`input[name="${radioGroupName}"]:checked`);
    if (!selectedOption) {
      resultPara.textContent = "Please select an answer.";
    } else if (selectedOption.value === quiz.answer) {
      resultPara.textContent = "Correct!";
    } else {
      resultPara.textContent = "Incorrect. Try again!";
    }
  });
  
  return quizDiv;
}


function loadCards(url) {
abortCurrentSlide();
  // ===== Fetch and Parse Slide Data from DSL File =====
fetch(url)
  .then(response => response.text())
  .then(text => {
    posts = parseDSL(text);
    currentSlideIndex = 0;
    displaySlide();
    createSlider();
  })
  .catch(error => console.error("Error loading DSL:", error));

}


function previewLoad(txt) {
  posts = parseDSL(txt);
  currentSlideIndex = 0;
  displaySlide();
  createSlider();
}
