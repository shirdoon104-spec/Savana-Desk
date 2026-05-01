"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const staffRoles = [
  "owner",
  "admin",
  "front_desk",
  "housekeeping",
  "maintenance",
  "restaurant_manager",
  "waiter",
  "kitchen",
  "accountant",
] as const;

type StaffRole = (typeof staffRoles)[number];

type LoadState = "idle" | "loading" | "ready" | "error";

function canManageStaff(role: string | undefined) {
  return role === "owner" || role === "admin";
}

async function readApiMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    return message ?? fallback;
  } catch {
    return fallback;
  }
}

interface TeamResponse {
  currentUser: {
    clerkUserId: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  users: Array<{
    id: string;
    clerkUserId: string;
    name: string;
    email: string | null;
    role: string;
    createdAt: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    invitationUrl: string | null;
    role: string;
    status: string;
    createdAt: string;
  }>;
}

interface WorkspaceContextResponse {
  user: {
    clerkUserId: string;
    role: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tenantResolved: boolean;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export default function SettingsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [workspaceContext, setWorkspaceContext] =
    useState<WorkspaceContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitedAccessMessage, setLimitedAccessMessage] = useState<string | null>(
    null,
  );
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("front_desk");
  const [isInviting, setIsInviting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(
    null,
  );
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(
    null,
  );

  const staffManagementAllowed = canManageStaff(team?.currentUser.role);
  const currentRole = team?.currentUser.role ?? workspaceContext?.user.role;
  const tenantName = team?.tenant.name ?? workspaceContext?.tenant?.name;

  async function getOrganizationToken() {
    return getToken(organization ? { organizationId: organization.id } : undefined);
  }

  useEffect(() => {
    async function loadTeam() {
      if (!isLoaded || !isSignedIn) {
        return;
      }

      setLoadState("loading");
      setError(null);
      setLimitedAccessMessage(null);

      const token = await getOrganizationToken();

      if (!token) {
        setLoadState("error");
        setError("Select or create a workspace organization before managing staff.");
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/team`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const message = await readApiMessage(
            response,
            "Could not load team access.",
          );

          if (response.status === 403 && message.includes("staff.read")) {
            const contextResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/tenancy/context`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            if (contextResponse.ok) {
              setWorkspaceContext(
                (await contextResponse.json()) as WorkspaceContextResponse,
              );
            }

            setTeam(null);
            setLimitedAccessMessage(
              "Your role does not include team management access.",
            );
            setLoadState("ready");
            return;
          }

          setLoadState("error");
          setError(message);
          return;
        }

        const payload = (await response.json()) as TeamResponse;
        setTeam({
          ...payload,
          invitations: uniqueById(payload.invitations),
          users: uniqueById(payload.users),
        });
        setLoadState("ready");
      } catch {
        setLoadState("error");
        setError("Could not reach the Rayaan API. Check that the API and database are running.");
      }
    }

    void loadTeam();
  }, [getToken, isLoaded, isSignedIn, organization]);

  async function inviteStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsInviting(true);

    const token = await getOrganizationToken();
    if (!token) {
      setError("Select or create a workspace organization before inviting staff.");
      setIsInviting(false);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/team/invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      },
    );
    setIsInviting(false);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not send invitation."));
      return;
    }

    const payload = (await response.json()) as TeamResponse["invitations"][number];

    setInviteEmail("");
    setTeam((current) =>
      current
        ? {
            ...current,
            invitations: uniqueById([payload, ...current.invitations]),
          }
        : current,
    );
  }

  async function copyInvitationLink(invitationId: string, invitationUrl: string) {
    await navigator.clipboard.writeText(invitationUrl);
    setCopiedInvitationId(invitationId);
    window.setTimeout(() => setCopiedInvitationId(null), 2000);
  }

  async function removeMember(user: TeamResponse["users"][number]) {
    if (
      !window.confirm(
        `Remove ${user.email ?? user.name} from this tenant workspace?`,
      )
    ) {
      return;
    }

    setError(null);
    setRemovingMemberId(user.id);

    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before removing staff.");
      setRemovingMemberId(null);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/team/members/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "DELETE",
      },
    );

    setRemovingMemberId(null);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not remove member."));
      return;
    }

    setTeam((current) =>
      current
        ? {
            ...current,
            users: current.users.filter((member) => member.id !== user.id),
          }
        : current,
    );
  }

  async function revokeInvitation(
    invitation: TeamResponse["invitations"][number],
  ) {
    setError(null);
    setRevokingInvitationId(invitation.id);

    const token = await getOrganizationToken();

    if (!token) {
      setError("Select or create a workspace organization before revoking invitations.");
      setRevokingInvitationId(null);
      return;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/team/invitations/${invitation.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "DELETE",
      },
    );

    setRevokingInvitationId(null);

    if (!response.ok) {
      setError(await readApiMessage(response, "Could not revoke invitation."));
      return;
    }

    setTeam((current) =>
      current
        ? {
            ...current,
            invitations: current.invitations.filter(
              (item) => item.id !== invitation.id,
            ),
          }
        : current,
    );
  }

  return (
    <div className="settings-grid">
      <section className="notice-panel">
        <p className="eyebrow">Settings</p>
        <h2>Workspace settings</h2>
        <p>
          Manage tenant security, staff roles, mobile money providers, offline
          devices, and audit logs from this workspace area.
        </p>
      </section>

      <section className="notice-panel tenant-test">
        <div>
          <p className="eyebrow">Team access</p>
          <h2>
            {tenantName ??
              (loadState === "loading" ? "Loading workspace" : "Workspace access")}
          </h2>
          <p>
            Current role:{" "}
            <strong>
              {currentRole?.replaceAll("_", " ") ??
                (loadState === "loading" ? "Loading" : "Not connected")}
            </strong>
          </p>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
        {limitedAccessMessage ? (
          <div className="empty-state">{limitedAccessMessage}</div>
        ) : null}

        {staffManagementAllowed ? (
          <form className="invite-form" onSubmit={inviteStaff}>
            <label>
              Staff email
              <input
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="reception@example.com"
                required
                type="email"
                value={inviteEmail}
              />
            </label>
            <label>
              Hotel role
              <select
                onChange={(event) => setInviteRole(event.target.value as StaffRole)}
                value={inviteRole}
              >
                {staffRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={isInviting} type="submit">
              {isInviting ? "Sending..." : "Invite staff"}
            </button>
          </form>
        ) : (
          <div className="empty-state">
            Ask an owner or admin to invite staff and assign hotel roles.
          </div>
        )}

        {team ? (
          <>
            <p className="subsection-title">Active members</p>
            <div className="team-list">
              {team.users.map((user) => (
                <div className="team-row" key={user.id}>
                  <div>
                    <strong>{user.name}</strong>
                    {user.email ? <span>{user.email}</span> : null}
                    <span>
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="team-row-actions">
                    <span className="role-pill">
                      {user.role.replaceAll("_", " ")}
                    </span>
                    {staffManagementAllowed &&
                    user.clerkUserId !== team.currentUser.clerkUserId ? (
                      <button
                        className="danger-button"
                        disabled={removingMemberId === user.id}
                        onClick={() => removeMember(user)}
                        type="button"
                      >
                        {removingMemberId === user.id ? "Removing" : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <p className="subsection-title">Pending invitations</p>
            <div className="team-list">
              {team.invitations.length ? (
                uniqueById(team.invitations).map((invitation) => (
                  <div className="team-row" key={invitation.id}>
                    <div>
                      <strong>{invitation.email}</strong>
                      <span>
                        Invited{" "}
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="team-row-actions">
                      <span className="role-pill">
                        {invitation.role.replaceAll("_", " ")}
                      </span>
                      {invitation.invitationUrl ? (
                        <button
                          className="secondary-button"
                          onClick={() =>
                            copyInvitationLink(
                              invitation.id,
                              invitation.invitationUrl as string,
                            )
                          }
                          type="button"
                        >
                          {copiedInvitationId === invitation.id
                            ? "Copied"
                            : "Copy link"}
                        </button>
                      ) : null}
                      {staffManagementAllowed ? (
                        <button
                          className="danger-button"
                          disabled={revokingInvitationId === invitation.id}
                          onClick={() => revokeInvitation(invitation)}
                          type="button"
                        >
                          {revokingInvitationId === invitation.id
                            ? "Revoking"
                            : "Revoke"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No pending invitations.</div>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
