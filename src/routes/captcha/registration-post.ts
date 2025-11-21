// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Request, Response, NextFunction } from "express"
import { logger } from "../../pkg"

/**
 * Handles POST requests to the registration route with captcha validation
 * This middleware checks if captcha validation failed and blocks the request
 */
export function registrationPostCaptchaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Check if captcha validation failed on POST
  if (req.method === "POST" && res.locals.captchaError) {
    logger.warn("Registration blocked due to captcha validation failure", {
      error: res.locals.captchaError,
    })
    // Render error page with captcha failure message
    res.status(400).render("error", {
      error: {
        message: res.locals.captchaError,
        code: 400,
      },
    })
    return
  }

  // Captcha is valid or not required, continue to next handler
  next()
}
