// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import {
  defaultConfig,
  RouteCreator,
  RouteRegistrator,
  setSession,
} from "../pkg"
import { navigationMenu } from "../pkg/ui"
import { CardGradient, CodeBox, Typography } from "@ory/elements-markup"

export const createWelcomeRoute: RouteCreator =
  (createHelpers) => async (req, res) => {
    // res.locals.projectName = "Welcome to Ory"

    const { frontend } = createHelpers(req, res)
    const session = req.session
    const { return_to } = req.query

    // Create a logout URL
    const logoutUrl =
      (
        await frontend
          .createBrowserLogoutFlow({
            cookie: req.header("cookie"),
            returnTo: (return_to && return_to.toString()) || "",
          })
          .catch(() => ({ data: { logout_url: "" } }))
      ).data.logout_url || ""

    let concepts = ""
    if (!Boolean(session)) {
      // not logged
      concepts = [
        CardGradient({
          heading: "Login",
          content:
            "Jump start your project and complete the quickstart tutorial to get a broader overview of Ory Network.",
          action: "/login",
          //target: "_blank",
        }),
        CardGradient({
          heading: "Subscribe",
          content:
            "Jump start your project and complete the quickstart tutorial to get a broader overview of Ory Network.",
          action: "/registration",
          //target: "_blank",
        }),
      ].join("\n")
    } else {
      // logged but email not verified
      if (
        session?.identity?.verifiable_addresses?.length &&
        session?.identity?.verifiable_addresses?.length > 0 &&
        session?.identity?.verifiable_addresses.find((v) => v.verified)
      ) {
        // a verified email exists
        concepts = [
          CardGradient({
            heading: "Logout",
            content:
              "Jump start your project and complete the quickstart tutorial to get a broader overview of Ory Network.",
            action: logoutUrl,
            //target: "_blank",
          }),
          CardGradient({
            heading: "Settings",
            content:
              "Jump start your project and complete the quickstart tutorial to get a broader overview of Ory Network.",
            action: "/settings",
            //target: "_blank",
          }),
        ].join("\n")
      } else {
        // logged with unverified email
        concepts = [
          CardGradient({
            heading: "Logout",
            content:
              "Jump start your project and complete the quickstart tutorial to get a broader overview of Ory Network.",
            action: logoutUrl,
            //target: "_blank",
          }),
          CardGradient({
            heading: "Verify",
            content:
              "Jump start your project and complete the quickstart tutorial to get a broader overview of Ory Network.",
            action: "/verification",
            //target: "_blank",
          }),
        ].join("\n")
      }
    }

    res.render("welcome", {
      /*layout: "welcome",
      nav: navigationMenu({
        navTitle: res.locals.projectName,
        session,
        logoutUrl,
        selectedLink: "welcome",
      }),
      projectInfoText: Typography({
        children: `Your Ory Account Experience is running at ${req.header(
          "host",
        )}.`,
        type: "regular",
        size: "small",
        color: "foregroundMuted",
      }),
      session: CodeBox({
        className: "session-code-box",
        children: JSON.stringify(session, null, 2),
      }),*/
      concepts: concepts,
    })
  }

export const registerWelcomeRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
  route = "/welcome",
) => {
  app.get(route, setSession(createHelpers), createWelcomeRoute(createHelpers))
}
