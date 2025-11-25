// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { Session } from "@ory/client"
import { Nav } from "@ory/elements-markup"

type NavigationMenuProps = {
  navTitle: string
  session?: Session
  logoutUrl?: string
  selectedLink?: "welcome" | "sessions"
}
/**
 * Renders the navigation bar with state
 * @param session
 * @param logoutUrl
 * @returns
 */
export const navigationMenu = ({
  navTitle,
  session,
  logoutUrl,
  selectedLink,
}: NavigationMenuProps) => {
  const links = [
    {
      name: "Overview",
      href: "welcome",
      iconLeft: "house",
      selected: false,
    },
    {
      name: "Session Information",
      href: "sessions",
      iconLeft: "users-viewfinder",
      selected: false,
    },
  ].map((link) => {
    if (selectedLink && link.href.includes(selectedLink)) {
      link.selected = true
    }
    return link
  })

  return Nav({
    className: "main-nav",
    navTitle: navTitle,
    navSections: [],
  })
}
