// Example JSON input (replace with your JSON data)
        const jsonText = `
         {
  "posts": [
    {
      "title": "1. What is the eBrain? Brief History of Computers and GPIO",
      "subtitle": "From Early Computers to Modern Microcontrollers",
      "description": "This tutorial explains what the eBrain is, along with a brief history of computers and GPIO. It covers the evolution of computing technology and how accessible GPIO interfaces led to the modern era of microcontrollers.",
      "tags": [
        "lessons",
        "education"
      ],
      "elements": [
        {
          "type": "text",
          "content": "The eBrain is a modern microcontroller platform that embodies the spirit of early computing. In this tutorial, you'll learn about the historical milestones in computing—from room-sized mainframes to today's compact devices—and understand how the concept of General Purpose Input/Output (GPIO) has transformed the way we interact with electronics."
        },
        {
          "type": "carousel",
          "content": [
            {
              "image": "https://example.com/images/vintage-computer.jpg",
              "alt": "Vintage Computer",
              "name": "Vintage Computer",
              "info": "A look back at early computers of the 1950s."
            },
            {
              "image": "https://example.com/images/gpio-board.jpg",
              "alt": "Modern GPIO Board",
              "name": "Modern GPIO",
              "info": "How accessible GPIO paved the way for platforms like the eBrain."
            }
          ]
        }
      ]
    },
    {
      "title": "2. Your First Circuits with the eBrain",
      "subtitle": "Building and Understanding Basic Electronic Circuits",
      "description": "Learn how to build simple circuits with the eBrain. This tutorial covers breadboarding, wiring, and understanding the components needed for basic electronic projects.",
      "tags": [
        "lessons",
        "electronics"
      ],
      "elements": [
        {
          "type": "text",
          "content": "In this tutorial, we walk you through the process of setting up a breadboard, connecting components such as resistors, LEDs, and sensors, and creating circuits that interact with the eBrain. You'll get a hands-on introduction to electronics and learn how to read circuit diagrams."
        },
        {
          "type": "iframe",
          "content": {
            "src": "https://www.example.com/tutorials/making-circuits"
          }
        }
      ]
    },
    {
      "title": "3. How to Connect the eBrain",
      "subtitle": "Establishing USB and WiFi Connections",
      "description": "A detailed guide on connecting the eBrain to your computer and network using the auto-connecting web interface. Learn both USB and WiFi connection methods.",
      "tags": [
        "lessons"
      ],
      "elements": [
        {
          "type": "text",
          "content": "The eBrain features an autoconnecting web interface that simplifies the connection process. In this guide, we explain how to use the interface to connect via USB and WiFi. You'll learn about the underlying firmware that automatically detects network settings and how to troubleshoot common issues."
        },
        {
          "type": "carousel",
          "content": [
            {
              "video": "https://youtu.be/connection-video",
              "alt": "Connecting the eBrain",
              "name": "eBrain Connection Tutorial",
              "info": "Watch how to set up the connection using both USB and WiFi."
            }
          ]
        }
      ]
    },
    {
      "title": "4. How to Build and Use the Robot",
      "subtitle": "Assembling and Operating Your eBrain-Powered Robot",
      "description": "This tutorial provides step-by-step instructions on assembling the robot kit powered by the eBrain, and how to operate it using the firmware.",
      "tags": [
        "projects",
        "lessons",
        "coding"
      ],
      "elements": [
        {
          "type": "text",
          "content": "Building the eBrain robot is both fun and educational. In this tutorial, you'll learn how to assemble the robot mechanically, wire it correctly, and load the appropriate firmware. The guide also covers basic control commands to get your robot moving and performing simple tasks."
        },
        {
          "type": "iframe",
          "content": {
            "src": "https://www.example.com/tutorials/build-robot"
          }
        }
      ]
    },
    {
      "title": "5. Output - Blink a Light: Introduction to GPIO Output",
      "subtitle": "Controlling an LED with the eBrain",
      "description": "An introductory tutorial on using GPIO output to blink an LED. This lesson covers the theory behind digital output and the practical wiring needed for an LED circuit.",
      "tags": [
        "electronics",
        "lessons",
        "coding"
      ],
      "elements": [
        {
          "type": "text",
          "content": "One of the simplest and most rewarding projects is blinking an LED. This tutorial explains the fundamentals of digital output, how to build an LED circuit, and how to program the eBrain firmware to control the LED's blinking pattern. Perfect for beginners to get started with GPIO."
        },
        {
          "type": "carousel",
          "content": [
            {
              "image": "https://example.com/images/led-circuit.jpg",
              "alt": "LED Circuit",
              "name": "LED Blinking Circuit",
              "info": "A basic LED circuit setup for testing GPIO output."
            }
          ]
        }
      ]
    },
    {
      "title": "6. Input - Read from a Button: Introduction to GPIO Input",
      "subtitle": "Capturing User Input with a Button",
      "description": "Learn how to read digital input from a button using the eBrain firmware. This tutorial covers the theory of GPIO input and practical wiring and coding examples.",
      "tags": [
        "lessons",
        "electronics",
        "coding"
      ],
      "elements": [
        {
          "type": "text",
          "content": "GPIO input is essential for interactive projects. In this lesson, you'll learn how to connect a button to the eBrain, read its state, and debounce the input. The tutorial also explains the theory behind digital input signals and how they can be used to trigger events in your code."
        },
        {
          "type": "iframe",
          "content": {
            "src": "https://www.example.com/tutorials/button-input"
          }
        }
      ]
    },
    {
      "title": "7. Analog Input: Theory and Application",
      "subtitle": "Reading Variable Sensor Data",
      "description": "An introduction to analog input on the eBrain. This tutorial explains the principles of analog-to-digital conversion and demonstrates practical applications with sensors.",
      "tags": [
        "analog",
        "input",
        "sensors"
      ],
      "elements": [
        {
          "type": "text",
          "content": "Analog input allows you to measure variable signals from sensors. In this tutorial, you will learn how analog-to-digital conversion works, set up an analog sensor, and write firmware to process these readings. It’s a crucial step toward building responsive and intelligent systems."
        },
        {
          "type": "carousel",
          "content": [
            {
              "image": "https://example.com/images/analog-input.jpg",
              "alt": "Analog Sensor Setup",
              "name": "Analog Input Example",
              "info": "An example of an analog sensor circuit connected to the eBrain."
            }
          ]
        }
      ]
    },
    {
      "title": "8. PWM: Pulse Width Modulation",
      "subtitle": "Controlling Devices with Digital Signals",
      "description": "This tutorial covers Pulse Width Modulation (PWM), a technique to simulate analog control with digital outputs. Learn how to use PWM to adjust LED brightness or motor speed.",
      "tags": [
        "PWM",
        "digital",
        "motors",
        "LED"
      ],
      "elements": [
        {
          "type": "text",
          "content": "PWM is a powerful method for controlling devices without true analog output. In this lesson, you'll learn how PWM works, how to implement it in the eBrain firmware, and examples of practical applications such as dimming an LED or controlling motor speed."
        },
        {
          "type": "iframe",
          "content": {
            "src": "https://www.example.com/tutorials/pwm"
          }
        }
      ]
    },
    {
      "title": "9. Using AI Blocks with the eBrain",
      "subtitle": "Integrating Artificial Intelligence",
      "description": "Learn how to incorporate AI blocks into your eBrain projects. This tutorial demonstrates how to add smart functionality by integrating AI-driven blocks into your firmware.",
      "tags": [
        "AI",
        "machine learning",
        "blocks",
        "smart projects"
      ],
      "elements": [
        {
          "type": "text",
          "content": "The eBrain firmware supports the use of AI blocks, enabling you to add machine learning capabilities to your projects. In this tutorial, you'll explore how to integrate AI blocks, train simple models, and apply AI techniques to process sensor data and control outputs. This is a great introduction to merging traditional electronics with modern AI."
        },
        {
          "type": "carousel",
          "content": [
            {
              "video": "https://youtu.be/ai-blocks-tutorial",
              "alt": "AI Blocks Overview",
              "name": "AI Blocks Tutorial",
              "info": "A comprehensive guide to integrating AI with the eBrain."
            }
          ]
        }
      ]
    },
    {
      "title": "10. Other Components",
      "subtitle": "Expanding Your eBrain Projects",
      "description": "An overview of additional components and peripherals that can be used with the eBrain to build more advanced projects.",
      "tags": [
        "components",
        "peripherals",
        "expansion",
        "tutorial"
      ],
      "elements": [
        {
          "type": "text",
          "content": "Beyond the core features of the eBrain, there are many components and peripherals available to extend its capabilities. This tutorial provides an overview of sensors, displays, communication modules, and other devices you can integrate with your eBrain to create complex and interactive projects."
        },
        {
          "type": "iframe",
          "content": {
            "src": "https://www.example.com/tutorials/other-components"
          }
        }
      ]
    }
  ]
}


`