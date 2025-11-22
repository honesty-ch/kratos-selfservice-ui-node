// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

/**
 * Registration route with server-side captcha validation
 * This is a complete copy of registration.ts that handles the entire flow
 * including captcha validation before forwarding to Kratos
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
  validateCaptchaMiddleware,
  validateCaptcha,
  decryptCaptchaAnswer,
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
        })
      })
      .catch(redirectOnSoftError(res, next, initFlowUrl))
  }

// POST handler - validates captcha and forwards to Kratos
export const handleRegistrationWithCaptchaSubmit =
  (createHelpers: any = defaultConfig) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const { captcha_answer, captcha_token, flow, ...kratosFields } = req.body
    const { frontend, kratosBrowserUrl } = createHelpers(req, res)

    logger.debug("Registration with captcha POST handler", {
      hasFlow: !!flow,
      hasCaptcha: !!captcha_answer,
      hasCaptchaToken: !!captcha_token,
      method: req.body.method,
    })

    // Validate captcha server-side
    if (!captcha_token) {
      logger.warn("Captcha token missing in registration submission")
      return res.status(400).render("error", {
        error: {
          message: "Captcha token is missing. Please try again.",
          code: 400,
        },
      })
    }

    const decrypted = decryptCaptchaAnswer(captcha_token)

    if (!decrypted) {
      logger.warn("Invalid captcha token in registration submission")
      return res.status(400).render("error", {
        error: {
          message: "Invalid captcha token. Please refresh and try again.",
          code: 400,
        },
      })
    }

    const validation = validateCaptcha(
      captcha_answer,
      decrypted.answer,
      decrypted.timestamp,
    )

    if (!validation.valid) {
      logger.warn("Captcha validation failed during registration", {
        error: validation.error,
      })
      return res.status(400).render("error", {
        error: {
          message: validation.error || "Captcha validation failed",
          code: 400,
        },
      })
    }

    logger.info("Captcha validated successfully, forwarding to Kratos")

    // Captcha is valid, forward the request to Kratos
    // Remove captcha fields from the body before sending to Kratos
    const kratosBody = { ...kratosFields }

    try {
      const response = await frontend.updateRegistrationFlow({
        flow: flow,
        updateRegistrationFlowBody: kratosBody,
        cookie: req.header("Cookie"),
      })

      // Check if Kratos response indicates success
      const flowData = response.data

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
      })

      // Handle Kratos errors
      if (axiosError.response) {
        const status = axiosError.response.status

        // Flow expired or not found
        if (status === 404 || status === 410 || status === 403) {
          logger.debug("Registration flow expired, redirecting to new flow")
          return res.redirect(303, "/registration")
        }

        // Validation errors from Kratos
        if (status === 400) {
          logger.debug("Kratos validation error, redirecting back to form")
          return res.redirect(303, `/registration?flow=${flow}`)
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

  // POST - handle form submission with captcha validation
  app.post(
    "/registration",
    validateCaptchaMiddleware,
    handleRegistrationWithCaptchaSubmit(createHelpers),
  )
}
