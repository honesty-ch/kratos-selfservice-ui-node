// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Request, Response } from "express"
import { RouteRegistrator } from "../pkg"
import { logger } from "../pkg/logger"
import { validateCaptchaMiddleware } from "../pkg/captcha"

/**
 * API endpoint to validate captcha
 * Uses the validateCaptchaMiddleware to perform validation
 */
export const registerCaptchaValidateRoute: RouteRegistrator = (app) => {
  app.post(
    "/api/captcha/validate",
    validateCaptchaMiddleware,
    (req: Request, res: Response) => {
      // Check if captcha validation passed
      if (res.locals.captchaValid) {
        logger.info("Captcha validation successful")
        return res.status(200).json({
          success: true,
          valid: true,
          message: "Captcha is valid",
        })
      }

      // Captcha validation failed
      const error = res.locals.captchaError || "Captcha validation failed"
      logger.warn("Captcha validation failed", { error })
      return res.status(400).json({
        success: false,
        valid: false,
        error: error,
      })
    },
  )
}
