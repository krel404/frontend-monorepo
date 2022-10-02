import React from "react";
import { css } from "@emotion/react";
import { useAppScope } from "@shades/common/app";
import Button from "./button";
import Avatar from "./avatar";
import * as Tooltip from "./tooltip";
import { useNavigate } from "react-router-dom";

const ProfilePreview = React.forwardRef(
  (
    { profilePicture, displayName, onlineStatus, walletAddress, userId },
    ref
  ) => {
    const [textCopied, setTextCopied] = React.useState(false);
    const navigate = useNavigate();

    const { actions, state } = useAppScope();
    const user = state.selectMe();

    const isLoggedInUser = user != null && user.id === userId;

    const isOnline = onlineStatus === "online";

    const sendMessage = () => {
      const redirect = (c) => navigate(`/channels/${c.id}`);
      const dmChannel = state.selectDmChannelFromUserId(userId);

      if (dmChannel != null) {
        redirect(dmChannel);
        return;
      }

      actions.createDmChannel({ memberUserIds: [userId] }).then(redirect);
    };

    const copyWalletAddress = () => {
      navigator.clipboard.writeText(walletAddress);
      setTextCopied(true);
      setTimeout(() => {
        setTextCopied(false);
      }, 3000);
    };

    return (
      <div
        ref={ref}
        css={css({
          width: "30rem",
          minWidth: 0,
          borderRadius: "0.4rem",
          overflow: "hidden",
        })}
      >
        <Avatar
          url={profilePicture.large}
          walletAddress={walletAddress}
          size="30rem"
          pixelSize={64}
          borderRadius={0}
        />
        <div style={{ padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2
              css={(theme) =>
                css({ fontSize: theme.fontSizes.large, fontWeight: "400" })
              }
            >
              {displayName}
            </h2>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <div
                  css={(theme) =>
                    css({
                      marginLeft: "1rem",
                      width: "0.8rem",
                      height: "0.8rem",
                      borderRadius: "50%",
                      background: isOnline
                        ? theme.colors.onlineIndicator
                        : "none",
                      boxShadow: isOnline
                        ? "none"
                        : `0 0 0 0.2rem ${theme.colors.textMuted} inset`,
                    })
                  }
                />
              </Tooltip.Trigger>
              <Tooltip.Content dark side="top" align="center" sideOffset={6}>
                User {onlineStatus === "online" ? "online" : "offline"}
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
          <div
            css={(theme) =>
              css({
                fontSize: theme.fontSizes.small,
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: theme.colors.textHeaderSecondary,
              })
            }
          >
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={`https://etherscan.io/address/${walletAddress}`}
                  rel="noreferrer"
                  target="_blank"
                  css={css({
                    color: "inherit",
                    textDecoration: "none",
                    ":hover": { textDecoration: "underline" },
                  })}
                >
                  {walletAddress}
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content dark side="top" align="start" sideOffset={4}>
                <div>
                  Click to see address on{" "}
                  <span css={(theme) => css({ color: theme.colors.linkColor })}>
                    etherscan.io
                  </span>
                </div>
              </Tooltip.Content>
            </Tooltip.Root>
          </div>

          {!isLoggedInUser && (
            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                gridGap: "1rem",
                marginTop: "1rem",
              })}
            >
              <Button
                variant="transparent"
                size="default"
                onClick={sendMessage}
              >
                Message
              </Button>
              <Button
                variant="transparent"
                size="default"
                onClick={copyWalletAddress}
                style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}
              >
                {textCopied ? "Address copied" : "Copy address"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default ProfilePreview;
