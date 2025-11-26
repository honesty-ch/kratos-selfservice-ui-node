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


    // Access captcha information from transient_payload
    const transientPayload = req.body.flow?.transient_payload

    if (transientPayload) {

      // Re-validate the captcha in the webhook
      if (transientPayload.captcha_token) {
        const decrypted = decryptCaptchaAnswer(transientPayload.captcha_token)

        if (!decrypted) {
          logger.error("Webhook: Invalid captcha token")
          // Return Kratos-compatible error format
          return res.status(400).json({
            messages: [
              {
                instance_ptr: "#/captcha_answer",
                messages: [
                  {
                    id: 4000001,
                    text: "Invalid captcha token",
                    type: "error",
                  },
                ],
              },
            ],
          })
        }

        const validation = validateCaptcha(
          transientPayload.captcha_answer,
          decrypted.answer,
          decrypted.timestamp,
        )

        if (!validation.valid) {
          logger.error("Webhook: Captcha validation failed", { error: validation.error })
          // Return Kratos-compatible error format
          return res.status(400).json({
            messages: [
              {
                instance_ptr: "#/captcha_answer",
                messages: [
                  {
                    id: 4000002,
                    text: validation.error || "Captcha validation failed",
                    type: "error",
                  },
                ],
              },
            ],
          })
        }

        logger.info("Webhook: Captcha re-validated successfully")
      }
    }

    // Captcha is valid - allow registration to proceed
    // Return empty response for success (Kratos doesn't need a body for 200 OK)
    res.status(200).send({
      success: true,
      message: "Before registration webhook received and captcha validated",
    })
  })
}
