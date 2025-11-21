// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Request, Response, NextFunction } from "express"
import { logger } from "./logger"

/**
 * Simple math-based CAPTCHA system
 * Generates basic arithmetic problems for bot protection
 */

export interface CaptchaChallenge {
  question: string
  answer: number
  timestamp: number
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

    // Store encrypted answer in locals for template rendering
    res.locals.captchaQuestion = captcha.question
    res.locals.captchaToken = encrypted

    logger.debug("Generated captcha", {
      question: captcha.question,
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
