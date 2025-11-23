// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Request, Response, NextFunction } from "express"
import { createCanvas } from "canvas"
import { logger } from "./logger"

/**
 * Simple math-based CAPTCHA system
 * Generates basic arithmetic problems for bot protection
 */

export interface CaptchaChallenge {
  question: string
  answer: number
  timestamp: number
  imageId?: string // ID to retrieve the generated image
}

/**
 * Generates a simple math captcha challenge
 */
export function generateCaptcha(): CaptchaChallenge {
  const num1 = Math.floor(Math.random() * 10) + 1
  const num2 = Math.floor(Math.random() * 10) + 1
  const operations = ["+", "-", "×"]
  const operation = operations[Math.floor(Math.random() * operations.length)]

  let answer: number
  let question: string

  switch (operation) {
    case "+":
      answer = num1 + num2
      question = `${num1} + ${num2}`
      break
    case "-":
      answer = num1 - num2
      question = `${num1} - ${num2}`
      break
    case "×":
      answer = num1 * num2
      question = `${num1} × ${num2}`
      break
    default:
      answer = num1 + num2
      question = `${num1} + ${num2}`
  }

  return {
    question,
    answer,
    timestamp: Date.now(),
  }
}

/**
 * Generates a CAPTCHA image with distorted text
 * @param text - The math equation to render
 * @returns Buffer containing PNG image data
 */
export function generateCaptchaImage(text: string): Buffer {
  // Create canvas
  const width = 200
  const height = 80
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")

  // Background with more varied gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  const bgShade1 = 230 + Math.random() * 25
  const bgShade2 = 210 + Math.random() * 25
  gradient.addColorStop(0, `rgb(${bgShade1}, ${bgShade1}, ${bgShade1})`)
  gradient.addColorStop(1, `rgb(${bgShade2}, ${bgShade2}, ${bgShade2})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Add wavy/curved noise lines (more organic looking)
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.25)`
    ctx.lineWidth = 1 + Math.random() * 2.5
    ctx.beginPath()

    const startX = Math.random() * width
    const startY = Math.random() * height
    ctx.moveTo(startX, startY)

    // Create bezier curves for wavy lines
    for (let j = 0; j < 2; j++) {
      const cp1x = Math.random() * width
      const cp1y = Math.random() * height
      const cp2x = Math.random() * width
      const cp2y = Math.random() * height
      const endX = Math.random() * width
      const endY = Math.random() * height
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY)
    }
    ctx.stroke()
  }

  // Add more varied noise dots with different sizes
  for (let i = 0; i < 80; i++) {
    const opacity = 0.15 + Math.random() * 0.3
    ctx.fillStyle = `rgba(${Math.random() * 150}, ${Math.random() * 150}, ${Math.random() * 150}, ${opacity})`
    ctx.beginPath()
    const size = 0.5 + Math.random() * 2.5
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      size,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }

  // Draw distorted text with more variation
  const fonts = ["Arial", "Helvetica", "Verdana", "Georgia"]
  const baseSize = 38 + Math.random() * 6
  ctx.textBaseline = "middle"

  const chars = text.split("")
  let x = 20 + Math.random() * 10

  chars.forEach((char, i) => {
    // More aggressive rotation and positioning
    const rotation = (Math.random() - 0.5) * 0.6 // Increased rotation range
    const yVariation = (Math.random() - 0.5) * 18 // More vertical movement
    const y = height / 2 + yVariation

    // Vary font size per character
    const fontSize = baseSize + (Math.random() - 0.5) * 8
    const font = fonts[Math.floor(Math.random() * fonts.length)]
    ctx.font = `bold ${fontSize}px ${font}`

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)

    // Apply random scaling/skewing for more distortion
    const scaleX = 0.9 + Math.random() * 0.3
    const scaleY = 0.85 + Math.random() * 0.35
    const skewX = (Math.random() - 0.5) * 0.2
    ctx.transform(scaleX, skewX, 0, scaleY, 0, 0)

    // More varied colors including some blues and greens
    const colors = [
      "#1a1a1a", "#2c3e50", "#34495e", "#16a085",
      "#27ae60", "#2980b9", "#8e44ad", "#c0392b"
    ]
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]

    // Stronger shadow for more depth
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)"
    ctx.shadowBlur = 2 + Math.random() * 3
    ctx.shadowOffsetX = 1 + Math.random() * 2
    ctx.shadowOffsetY = 1 + Math.random() * 2

    // Draw the character
    ctx.fillText(char, 0, 0)

    // Add outline/stroke to some characters for extra complexity
    if (Math.random() > 0.5) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.1 + Math.random() * 0.2})`
      ctx.lineWidth = 0.5
      ctx.strokeText(char, 0, 0)
    }

    ctx.restore()

    // More varied spacing between characters
    const charWidth = ctx.measureText(char).width
    x += charWidth * scaleX + 3 + Math.random() * 12
  })

  // Add some diagonal interference lines
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = `rgba(${Math.random() * 80}, ${Math.random() * 80}, ${Math.random() * 80}, 0.15)`
    ctx.lineWidth = 1 + Math.random() * 1.5
    ctx.beginPath()
    if (Math.random() > 0.5) {
      // Horizontal-ish line
      ctx.moveTo(0, Math.random() * height)
      ctx.lineTo(width, Math.random() * height)
    } else {
      // Vertical-ish line
      ctx.moveTo(Math.random() * width, 0)
      ctx.lineTo(Math.random() * width, height)
    }
    ctx.stroke()
  }

  // Add border
  ctx.strokeStyle = "#999"
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, width - 2, height - 2)

  return canvas.toBuffer("image/png")
}

// In-memory store for captcha images (temporary storage)
// In production, consider using Redis or another cache
const captchaImageStore = new Map<string, Buffer>()

/**
 * Stores a captcha image and returns its ID
 */
export function storeCaptchaImage(imageBuffer: Buffer): string {
  const imageId = Math.random().toString(36).substring(2, 15)
  captchaImageStore.set(imageId, imageBuffer)

  // Auto-cleanup after 10 minutes
  setTimeout(() => {
    captchaImageStore.delete(imageId)
  }, 10 * 60 * 1000)

  return imageId
}

/**
 * Retrieves a captcha image by ID
 */
export function getCaptchaImage(imageId: string): Buffer | undefined {
  return captchaImageStore.get(imageId)
}

/**
 * Encrypts the captcha answer with timestamp for session storage
 */
export function encryptCaptchaAnswer(answer: number, timestamp: number): string {
  const data = `${answer}:${timestamp}`
  return Buffer.from(data).toString("base64")
}

/**
 * Decrypts the captcha answer from session storage
 */
export function decryptCaptchaAnswer(
  encrypted: string,
): { answer: number; timestamp: number } | null {
  try {
    const data = Buffer.from(encrypted, "base64").toString("utf-8")
    const [answer, timestamp] = data.split(":")
    return {
      answer: parseInt(answer, 10),
      timestamp: parseInt(timestamp, 10),
    }
  } catch (error) {
    logger.error("Failed to decrypt captcha answer", { error })
    return null
  }
}

/**
 * Validates captcha answer
 * @param userAnswer - Answer provided by user
 * @param expectedAnswer - Expected answer from challenge
 * @param timestamp - Timestamp when captcha was generated
 * @param maxAgeMs - Maximum age of captcha in milliseconds (default: 5 minutes)
 */
export function validateCaptcha(
  userAnswer: string | undefined,
  expectedAnswer: number,
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000,
): { valid: boolean; error?: string } {
  if (!userAnswer) {
    return { valid: false, error: "Captcha answer is required" }
  }

  const userAnswerNum = parseInt(userAnswer, 10)

  if (isNaN(userAnswerNum)) {
    return { valid: false, error: "Invalid captcha answer format" }
  }

  // Check if captcha has expired
  const age = Date.now() - timestamp
  if (age > maxAgeMs) {
    return { valid: false, error: "Captcha has expired, please try again" }
  }

  if (userAnswerNum !== expectedAnswer) {
    return { valid: false, error: "Incorrect captcha answer" }
  }

  return { valid: true }
}

/**
 * Middleware to generate captcha for GET requests
 */
export function generateCaptchaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "GET") {
    const captcha = generateCaptcha()
    const encrypted = encryptCaptchaAnswer(captcha.answer, captcha.timestamp)

    // Generate captcha image
    const imageBuffer = generateCaptchaImage(captcha.question)
    const imageId = storeCaptchaImage(imageBuffer)

    // Store encrypted answer in locals for template rendering
    res.locals.captchaQuestion = captcha.question
    res.locals.captchaToken = encrypted
    res.locals.captchaImageId = imageId

    logger.debug("Generated captcha with image", {
      question: captcha.question,
      imageId: imageId,
      timestamp: captcha.timestamp,
    })
  }

  next()
}

/**
 * Middleware to validate captcha for POST requests
 * Returns error in res.locals.captchaError if validation fails
 */
export function validateCaptchaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "POST") {
    const userAnswer = req.body.captcha_answer
    const captchaToken = req.body.captcha_token

    logger.debug("Validating captcha", {
      hasUserAnswer: !!userAnswer,
      hasCaptchaToken: !!captchaToken,
    })

    if (!captchaToken) {
      res.locals.captchaError = "Captcha token is missing"
      logger.warn("Captcha validation failed: missing token")
      next()
      return
    }

    const decrypted = decryptCaptchaAnswer(captchaToken)

    if (!decrypted) {
      res.locals.captchaError = "Invalid captcha token"
      logger.warn("Captcha validation failed: invalid token")
      next()
      return
    }

    const validation = validateCaptcha(
      userAnswer,
      decrypted.answer,
      decrypted.timestamp,
    )

    if (!validation.valid) {
      res.locals.captchaError = validation.error
      logger.warn("Captcha validation failed", { error: validation.error })
    } else {
      res.locals.captchaValid = true
      logger.debug("Captcha validation successful")
    }
  }

  next()
}
