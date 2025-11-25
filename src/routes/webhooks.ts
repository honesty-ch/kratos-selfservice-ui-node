// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Request, Response } from "express"
import { RouteRegistrator } from "../pkg"
import { logger } from "../pkg/logger"
import { decryptCaptchaAnswer, validateCaptcha } from "../pkg/captcha"

/**
 * Empty webhook endpoint for before-registration
 * This can be used as a hook point to perform actions before user registration
 */
export const registerWebhooksRoute: RouteRegistrator = (app) => {
  app.post("/webhooks/before-registration", (req: Request, res: Response) => {
    logger.debug("Before registration webhook called", {
      body: req.body,
      headers: req.headers,
    })

    console.log("Full webhook payload:", JSON.stringify(req.body.flow?.transient_payload, null, 2))

    // Access captcha information from transient_payload
    const transientPayload = req.body.flow?.transient_payload

    if (transientPayload) {
      console.log("Captcha answer:", transientPayload.captcha_answer)
      console.log("Captcha token:", transientPayload.captcha_token)
      console.log("Captcha validated:", transientPayload.captcha_validated)
      console.log("Captcha validated at:", transientPayload.captcha_validated_at)

      // Re-validate the captcha in the webhook
      if (transientPayload.captcha_token) {
        const decrypted = decryptCaptchaAnswer(transientPayload.captcha_token)

        if (!decrypted) {
          logger.error("Webhook: Invalid captcha token")
          return res.status(400).json({
            success: false,
            error: "Invalid captcha token",
          })
        }

        const validation = validateCaptcha(
          transientPayload.captcha_answer,
          decrypted.answer,
          decrypted.timestamp,
        )

        if (!validation.valid) {
          logger.error("Webhook: Captcha validation failed", { error: validation.error })
          return res.status(400).json({
            success: false,
            error: validation.error || "Captcha validation failed",
          })
        }

        logger.info("Webhook: Captcha re-validated successfully")
      }
    }

    // Access identity traits (email, etc.)
    /*const traits = req.body.identity?.traits
    if (traits) {
      console.log("User traits:", traits)
    }*/

    // Captcha is valid - allow registration to proceed
    res.status(200).json({
      success: true,
      message: "Before registration webhook received and captcha validated",
    })
  })
}
