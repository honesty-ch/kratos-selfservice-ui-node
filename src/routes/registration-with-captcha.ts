// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

/**
 * Registration route with captcha data forwarding
 * Captcha validation happens in the webhook endpoint
 */

import {
  defaultConfig,
  generateCaptchaMiddleware,
  getUrlForFlow,
  isQuerySet,
  logger,
  redirectOnSoftError,
  RouteCreator,
  RouteRegistrator,
  getCaptchaImage,
} from "../pkg"
import { UserAuthCard } from "@ory/elements-markup"
import { URLSearchParams } from "url"
import { Request, Response, NextFunction } from "express"
import sdk from "../pkg/sdk"
import { AxiosError } from "axios"

// GET handler - shows the registration screen with captcha
export const createRegistrationWithCaptchaRoute: RouteCreator =
  (createHelpers) => (req, res, next) => {
    res.locals.projectName = "Create account"

    const {
      flow,
      return_to,
      after_verification_return_to,
      login_challenge,
      organization,
      identity_schema = "",
      captcha_error,
    } = req.query
    const { frontend, kratosBrowserUrl, logoUrl, extraPartials } =
      createHelpers(req, res)

    const initFlowQuery = new URLSearchParams({
      ...(return_to && { return_to: return_to.toString() }),
      ...(organization && { organization: organization.toString() }),
      ...(identity_schema && { identity_schema: identity_schema.toString() }),
      ...(after_verification_return_to && {
        after_verification_return_to: after_verification_return_to.toString(),
      }),
    })

    if (isQuerySet(login_challenge)) {
      logger.debug("login_challenge found in URL query: ", { query: req.query })
      initFlowQuery.append("login_challenge", login_challenge)
    } else {
      logger.debug("no login_challenge found in URL query: ", {
        query: req.query,
      })
    }

    const initFlowUrl = getUrlForFlow(
      kratosBrowserUrl,
      "registration",
      initFlowQuery,
    )

    // The flow is used to identify the settings and registration flow and
    // return data like the csrf_token and so on.
    if (!isQuerySet(flow)) {
      logger.debug("No flow ID found in URL query initializing login flow", {
        query: req.query,
      })
      res.redirect(303, initFlowUrl)
      return
    }

    frontend
      .getRegistrationFlow({ id: flow, cookie: req.header("Cookie") })
      .then(({ data: flow }) => {
        // Render the data using a view (e.g. Jade Template):
        const initLoginQuery = new URLSearchParams({
          return_to:
            (return_to && return_to.toString()) || flow.return_to || "",
          ...(flow.identity_schema && {
            identity_schema: flow.identity_schema.toString(),
          }),
          ...(flow.oauth2_login_request?.challenge && {
            login_challenge: flow.oauth2_login_request.challenge,
          }),
        })

        res.render("registration", {
          nodes: flow.ui.nodes,
          card: UserAuthCard(
            {
              flow,
              flowType: "registration",
              cardImage: logoUrl,
              additionalProps: {
                loginURL: getUrlForFlow(
                  kratosBrowserUrl,
                  "login",
                  initLoginQuery,
                ),
              },
            },
            { locale: res.locals.lang },
          ),
          extraPartial: extraPartials?.registration,
          extraContext: res.locals.extraContext,
          captchaQuestion: res.locals.captchaQuestion,
          captchaToken: res.locals.captchaToken,
          captchaImageId: res.locals.captchaImageId,
          captchaError: captcha_error
            ? decodeURIComponent(captcha_error.toString())
            : undefined,
        })
      })
      .catch(redirectOnSoftError(res, next, initFlowUrl))
  }

// POST handler - validates captcha server-side ONLY and forwards to Kratos
export const handleRegistrationWithCaptchaSubmit =
  (createHelpers: any = defaultConfig) =>
  async (req: Request, res: Response, next: NextFunction) => {
    logger.info("=== Registration POST handler called ===")
    logger.info("Request body keys:", Object.keys(req.body))
    logger.info("Full request body:", req.body)
    logger.info("Query params:", req.query)

    // Flow ID comes from query params, not body
    const flow = (req.query.flow || req.body.flow) as string
    const { captcha_answer, captcha_token, ...kratosFields } = req.body
    const { frontend } = createHelpers(req, res)

    logger.debug("Registration with captcha POST handler", {
      hasFlow: !!flow,
      hasCaptcha: !!captcha_answer,
      hasCaptchaToken: !!captcha_token,
      method: req.body.method,
      captcha_answer: captcha_answer,
      flow: flow,
    })

    logger.info("Forwarding registration to Kratos with captcha data in transient_payload")

    // Captcha is valid, forward the request to Kratos
    // Include captcha information in transient_payload for webhook access
    const kratosBody = {
      ...kratosFields,
      transient_payload: {
        captcha_answer: captcha_answer,
        captcha_token: captcha_token,
        captcha_validated: true,
        captcha_validated_at: new Date().toISOString(),
      },
    }

    try {
      const response = await frontend.updateRegistrationFlow({
        flow: flow,
        updateRegistrationFlowBody: kratosBody,
        cookie: req.header("Cookie"),
      })

      // Check if Kratos response indicates success
      const flowData = response.data
      const headers = response.headers

      // CRITICAL: Forward session cookies from Kratos to the browser
      // This is what actually logs the user in
      if (headers["set-cookie"]) {
        res.setHeader("set-cookie", headers["set-cookie"])
        logger.debug("Session cookies set from Kratos response")
      }

      // Check for continue_with actions or session
      if (flowData.session) {
        // Registration was successful
        logger.debug("Registration successful, session created")

        // Check if there's a return_to URL in the flow
        const returnTo = (flowData as any).return_to
        if (returnTo) {
          logger.debug("Redirecting to return_to URL", { returnTo })
          return res.redirect(303, returnTo)
        }

        // Default redirect after successful registration
        return res.redirect(303, "/welcome")
      }

      // If no session yet, the flow might need more steps
      logger.debug("Registration flow continues, re-rendering form")
      return res.redirect(303, `/registration?flow=${flow}`)
    } catch (error) {
      const axiosError = error as AxiosError

      logger.error("Error forwarding registration to Kratos", {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        responseBody: axiosError.response?.data,
      })

      // Handle Kratos errors
      if (axiosError.response) {
        const status = axiosError.response.status
        const responseData = axiosError.response.data as any

        // Flow expired or not found
        if (status === 404 || status === 410 || status === 403) {
          logger.debug("Registration flow expired, redirecting to new flow")
          return res.redirect(303, "/registration")
        }

        // Validation errors from Kratos (including webhook failures)
        if (status === 400) {
          logger.debug("Kratos validation error, checking for webhook error", {
            responseData: JSON.stringify(responseData, null, 2)
          })

          // Extract error messages
          const messages = responseData?.ui?.messages || []
          const webhookError = messages.find((msg: any) =>
            msg.text?.toLowerCase().includes("captcha") ||
            msg.type === "error"
          )

          if (webhookError || responseData?.ui) {
            // We have validation error with flow data - render the form with pre-filled data
            logger.warn("Webhook validation failed, re-rendering form with errors")

            const { kratosBrowserUrl, logoUrl, extraPartials } = createHelpers(req, res)

            // Generate new captcha for retry
            const captcha = require('../pkg/captcha').generateCaptcha()
            const encrypted = require('../pkg/captcha').encryptCaptchaAnswer(captcha.answer, captcha.timestamp)
            const imageBuffer = require('../pkg/captcha').generateCaptchaImage(captcha.question)
            const imageId = require('../pkg/captcha').storeCaptchaImage(imageBuffer)

            const errorText = webhookError?.text ||
                             responseData?.error?.message ||
                             responseData?.message ||
                             "Validation failed. Please try again."

            // Filter out captcha fields from nodes (they're not part of the identity schema)
            const filteredNodes = responseData.ui.nodes.filter((node: any) => {
              const nodeName = node.attributes?.name
              return nodeName !== 'captcha_answer' && nodeName !== 'captcha_token'
            })

            // Create a cleaned flow object without captcha fields
            const cleanedFlow = {
              ...responseData,
              ui: {
                ...responseData.ui,
                nodes: filteredNodes,
              },
            }

            return res.render("registration", {
              nodes: filteredNodes,
              card: UserAuthCard(
                {
                  flow: cleanedFlow,
                  flowType: "registration",
                  cardImage: logoUrl,
                  additionalProps: {
                    loginURL: getUrlForFlow(
                      kratosBrowserUrl,
                      "login",
                      new URLSearchParams(),
                    ),
                  },
                },
                { locale: res.locals.lang },
              ),
              extraPartial: extraPartials?.registration,
              extraContext: res.locals.extraContext,
              captchaQuestion: captcha.question,
              captchaToken: encrypted,
              captchaImageId: imageId,
              captchaError: errorText,
            })
          }

          // Generic validation error from Kratos - redirect back with new flow
          logger.debug("Kratos validation error (non-captcha), redirecting to new registration flow")
          return res.redirect(303, "/registration")
        }
      }

      // Generic error
      return res.status(500).render("error", {
        error: {
          message: "An error occurred during registration. Please try again.",
          code: 500,
        },
      })
    }
  }

export const registerRegistrationWithCaptchaRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
) => {
  // GET - show registration form with captcha
  app.get(
    "/registration",
    generateCaptchaMiddleware,
    createRegistrationWithCaptchaRoute(createHelpers),
  )

  // POST - handle form submission with server-side ONLY captcha validation
  app.post("/registration", handleRegistrationWithCaptchaSubmit(createHelpers))

  // GET - serve captcha image
  app.get("/captcha/image/:imageId", (req: Request, res: Response) => {
    const imageId = req.params.imageId
    const imageBuffer = getCaptchaImage(imageId)

    if (!imageBuffer) {
      logger.warn("Captcha image not found", { imageId })
      return res.status(404).send("Image not found")
    }

    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.setHeader("Pragma", "no-cache")
    res.setHeader("Expires", "0")
    res.send(imageBuffer)
  })
}
