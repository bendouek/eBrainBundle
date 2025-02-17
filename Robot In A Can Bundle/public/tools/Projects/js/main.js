var audioPlayer;
let currentTrackIndex = 0;
var tracks;

function playTrack(index, src) {
    currentTrackIndex = index;
    audioPlayer.src = src;
    audioPlayer.style.display = "block";
    audioPlayer.play();

    // Highlight the currently playing track
    tracks.forEach(track => track.style.backgroundColor = "#f9f9f9");
    document.getElementById(`track${index}`).style.backgroundColor = "#e0e0e0";
}

function stopTrack() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.style.display = "none";

    // Remove highlight from all tracks
    tracks.forEach(track => track.style.backgroundColor = "#f9f9f9");
}


var currentSlide = 0;
var slides = document.querySelectorAll('.carousel');

function showSlide(index) {
    slides = document.querySelectorAll('.carousel');
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
}

function nextSlide() {
    slides = document.querySelectorAll('.carousel');
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
}

function prevSlide() {
    slides = document.querySelectorAll('.carousel');
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(currentSlide);
}


var isotope = new Isotope('#blog-container', {
    itemSelector: '.grid-item',
    layoutMode: 'masonry',
    masonry: {
        columnWidth: 180,
        gutter: 10,
        horizontalOrder: false
    }
});


// Initialize Isotope
function initializeIsotope() {
    isotope = new Isotope('#blog-container', {
        itemSelector: '.grid-item',
        layoutMode: 'masonry',
        masonry: {
            columnWidth: 180,
            gutter: 10,
            horizontalOrder: false
        }
    });

    // Ensure layout is recalculated after content is added
    isotope.layout();
}



function collapseExpanded(){
    // Collapse any expanded article
    const expandedArticles = document.querySelectorAll('.blog-article.expanded');
    expandedArticles.forEach(expandedArticle => {
        expandedArticle.classList.remove('expanded');
        expandedArticle.querySelectorAll('.additional-content').forEach(el => el.remove());
        // Trigger Isotope layout after the collapse animation
        initializeIsotope();
    });
}



function filterPosts(tag) {
    const articles = document.querySelectorAll('article');
    const buttons = document.querySelectorAll('#tag-buttons button');
    collapseExpanded();
    

    // Remove the 'active' class from all buttons
    buttons.forEach(button => button.classList.remove('active'));
    
    // Add the 'active' class to the clicked button
    document.querySelector(`button[onclick="filterPosts('${tag}')"]`).classList.add('active');

    // Show/Hide articles based on the selected tag
    articles.forEach(article => {
        if (tag === 'all' || article.getAttribute('data-tags').includes(tag)) {
            article.style.display = 'inline-block';
        } else {
            article.style.display = 'none';
        }
    });

    delay(400).then(() => initializeIsotope());

}


function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}


function scrollToExpanded() {
  // Find the first element with the class 'expanded'
  const expandedElement = document.querySelector('.expanded');
  
  // Check if the element exists
  if (expandedElement) {
    // Scroll the element into view
    expandedElement.scrollIntoView({
      behavior: 'smooth', // Smooth scroll animation
      block: 'start',    // Center the element in the viewport
      inline: 'nearest'   // Adjust for horizontal scroll if needed
    });
  } else {
    console.log('No element with the class "expanded" found.');
  }
}


function createElementFromHTML(htmlString) {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  // Change this to div.childNodes to support multiple top-level nodes.
  return div.firstChild;
}



function generateIframe(iframeData) {
  var div = document.createElement('div');
  var frame = document.createElement('iframe');
  frame.id = "responsive-iframe";
  frame.src = iframeData.src;
  frame.height="750";
  div.appendChild(frame);
  div.classList.add('iframe-container');
  // Change this to div.childNodes to support multiple top-level nodes.
  return div;
}


function generateCarouselHTML(carouselData) {
    // Find the carousel object in the data (assuming only one "carousel" element)
    const carouselContent = carouselData; 
    
    // Create the carousel div
    const carouselDiv = document.createElement('div');
    carouselDiv.classList.add('carousel-box');

    const itemDiv = document.createElement('div'); // Create a div for each item
    itemDiv.classList.add('carousel-controls');
    itemDiv.innerHTML = '<button class="control-button" onclick="prevSlide()">&#10094; Prev</button><button class="control-button" onclick="nextSlide()">Next &#10095;</button>';
    carouselDiv.appendChild(itemDiv);
    

    // Loop through each item in the content array
    carouselContent.forEach((item,index) => {
        const itemDiv = document.createElement('div'); // Create a div for each item
        itemDiv.classList.add('carousel');
        if (index == 0){
            itemDiv.classList.add('active');
        }


        if (typeof item.src !== 'undefined'){
            // Create the image element
            const img = document.createElement('img');
            img.src = item.src;
            img.alt = item.alt;
            itemDiv.appendChild(img);
        } 

        if (typeof item.video !== 'undefined'){
            // Create the video element
            var urlVid = '<iframe width="800" height="450" src="'+ item.video +'" title="Wicked FPV Drone Rip Through School Yard at Dawn! 🏫🌅 | Morning Freestyle First-Person View" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
            const img =  createElementFromHTML(urlVid);
            itemDiv.appendChild(img);
        } 

        //add support for more carousel types
        

        // Create the heading for the item
        const heading = document.createElement('h2');
        heading.textContent = item.name;

        // Create the info paragraph
        const info = document.createElement('p');
        info.textContent = item.info;

        // Append the image, heading, and info to the item div
        itemDiv.appendChild(heading);
        itemDiv.appendChild(info);

        // Append the item div to the carousel
        carouselDiv.appendChild(itemDiv);
    });

    // Return the created carousel div
    return carouselDiv;
}





function generatePlaylist(tracks) {
  // Create the main playlist container
  const playlistContainer = document.createElement('div');
  playlistContainer.classList.add('playlist-container');

  // Add the playlist title
  const playlistTitle = document.createElement('div');
  playlistTitle.classList.add('playlist-title');
  playlistTitle.textContent = 'Simulated Art';
  playlistContainer.appendChild(playlistTitle);

  // Loop through each track and create the structure
  tracks.forEach((track, index) => {
    // Create the track container
    const trackDiv = document.createElement('div');
    trackDiv.classList.add('track');
    trackDiv.id = `track${index}`;

    // Create the track info section
    const trackInfo = document.createElement('div');
    trackInfo.classList.add('track-info');

    const trackTitle = document.createElement('span');
    trackTitle.textContent = `Track ${index + 1}: ${track.title}`;
    const trackDuration = document.createElement('span');
    trackDuration.textContent = track.duration || '4:00'; // Default duration if not provided

    trackInfo.appendChild(trackTitle);
    trackInfo.appendChild(trackDuration);
    trackDiv.appendChild(trackInfo);

    // Create the controls section
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

    // Append the track to the playlist container
    playlistContainer.appendChild(trackDiv);
  });


  // Add an audio player to the container
  audioPlayer = document.createElement('audio');
  audioPlayer.id = 'audioPlayer';
  audioPlayer.controls = true;
  audioPlayer.style.width = '100%';
  audioPlayer.style.display = 'none';
  

  currentTrackIndex = 0;
        
    // Autoplay the next track when the current one ends
    audioPlayer.addEventListener('ended', () => {
        tracks = document.querySelectorAll('.track');
        currentTrackIndex++;
        if (currentTrackIndex < tracks.length) {
            const nextTrack = tracks[currentTrackIndex];
            const nextSrc = nextTrack.querySelector('button').getAttribute('onclick').match(/'([^']+)'/)[1];
            playTrack(currentTrackIndex, nextSrc);
        } else {
            stopTrack(); // Stop when all tracks have played
        }
    });

    playlistContainer.appendChild(audioPlayer);


    return playlistContainer;
}






// Function to process JSON text and populate the blog
function populateBlog(jsonText) {
    // Parse the JSON text
    const blogData = JSON.parse(jsonText);

    // Get the blog container element
    const blogContainer = document.getElementById('blog-container');
    
    // Clear existing content in the blog container
    blogContainer.innerHTML = '';

    // Iterate over each post in the JSON data
    blogData.posts.forEach(post => {
        // Create the article element
        const article = document.createElement('article');
        article.setAttribute('data-tags', post.tags.join(' '));
        article.classList.add('blog-article', 'grid-item');

        // Create and append the title
        const title = document.createElement('h2');
        title.textContent = post.title;
        article.appendChild(title);

        // Create and append the description
        const description = document.createElement('p');
        description.textContent = post.description;
        article.appendChild(description);

        // Add click event to expand and display additional content
        article.addEventListener('click', function () {
            if (!article.classList.contains('expanded')){
                collapseExpanded();

                // Expand the clicked article
                article.classList.add('expanded');

                // Create and append additional content
                post.elements.forEach(element => {
                    const additionalContent = document.createElement('div');
                    additionalContent.classList.add('additional-content');

                    if (element.type === 'text') {
                        const paragraph = document.createElement('p');
                        paragraph.textContent = element.content;
                        additionalContent.appendChild(paragraph);
                    } else if (element.type === 'image') {
                        const img = document.createElement('img');
                        img.src = element.content.src;
                        img.alt = element.content.alt || '';
                        additionalContent.appendChild(img);
                    } else if (element.type === 'download') {
                        const downloadLink = document.createElement('a');
                        downloadLink.href = element.content.href;
                        downloadLink.download = element.content.filename;
                        downloadLink.textContent = `Download ${element.content.filename}`;
                        additionalContent.appendChild(downloadLink);
                    } else if (element.type === 'carousel') {
                        additionalContent.appendChild(generateCarouselHTML(element.content)); 
                    } else if (element.type === 'audio') {
                        additionalContent.appendChild(generatePlaylist(element.content));  
                    } else if (element.type === 'iframe') {
                        additionalContent.appendChild(generateIframe(element.content));  
                    } else if (element.type === 'html') {
                        additionalContent.appendChild(createElementFromHTML(element.content));  
                    }
                    article.appendChild(additionalContent);
                });

                delay(500).then(() => initializeIsotope());
                delay(600).then(() => scrollToExpanded());

            } 
            
        });

        // Append the article to the blog container
        blogContainer.appendChild(article);

    });

    // Initialize or reload Isotope after content is added
    initializeIsotope();
    
}




// Call the function to populate the blog
populateBlog(jsonText);



function sendXMLUrlToSnap(xmlUrl) {
    // Create a message object
    const message = {
      type: 'loadXML',
      xmlURL: xmlUrl
    };
    window.parent.postMessage(message, "*");
}
//sendXMLUrlToSnap();
