// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Request, Response, Router } from "express"
import { logger, validateCaptcha, decryptCaptchaAnswer } from "../../pkg"

/**
 * API endpoint to validate captcha
 * Returns JSON with validation result
 */
export function registerCaptchaApiRoute(router: Router) {
  router.post("/api/captcha/validate", (req: Request, res: Response) => {
    const { captcha_answer, captcha_token } = req.body

    logger.debug("Captcha validation API called", {
      hasAnswer: !!captcha_answer,
      hasToken: !!captcha_token,
    })

    if (!captcha_token) {
      return res.status(400).json({
        valid: false,
        error: "Captcha token is missing",
      })
    }

    const decrypted = decryptCaptchaAnswer(captcha_token)

    if (!decrypted) {
      return res.status(400).json({
        valid: false,
        error: "Invalid captcha token",
      })
    }

    const validation = validateCaptcha(
      captcha_answer,
      decrypted.answer,
      decrypted.timestamp,
    )

    if (!validation.valid) {
      logger.warn("Captcha validation failed via API", {
        error: validation.error,
      })
      return res.status(400).json({
        valid: false,
        error: validation.error,
      })
    }

    logger.debug("Captcha validation successful via API")
    return res.json({
      valid: true,
    })
  })
}
