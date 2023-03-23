import { useEnsName } from "wagmi";
import React from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import {
  useActions,
  useAuth,
  useCachedState,
  useServerConnectionState,
  useMe,
  useChannel,
  useChannelName,
  useMemberChannels,
  usePublicChannels,
  useStarredChannels,
  useChannelHasUnread,
  useChannelMentionCount,
  useHasFetchedMenuData,
} from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import {
  useState as useSidebarState,
  useToggle as useSidebarToggle,
  Layout as SidebarLayout,
} from "@shades/ui-web/sidebar-layout";
import {
  DoubleChevronLeft as DoubleChevronLeftIcon,
  MagnificationGlass as MagnificationGlassIcon,
  PlusSmall as PlusSmallIcon,
  Triangle as TriangleIcon,
} from "@shades/ui-web/icons";
import useCommandCenter from "../hooks/command-center";
import UserAvatar from "./user-avatar";
import ChannelAvatar from "./channel-avatar";
import * as DropdownMenu from "./dropdown-menu";
import CreateChannelDialog from "./create-channel-dialog";
import NotificationBadge from "./notification-badge";
import Spinner from "./spinner";

const { sort, comparator } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const TRUNCATION_THRESHOLD = 8;

const Layout = () => {
  const params = useParams();

  const { open: openCommandCenter } = useCommandCenter();

  const serverConnectionState = useServerConnectionState();

  const { status: authenticationStatus } = useAuth();
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();
  const actions = useActions();

  const user = useMe();

  const [collapsedIds, setCollapsedIds] = useCachedState(
    "main-menu:collapsed",
    []
  );

  const [truncatedSections, setTruncatedSections] = React.useState([
    "starred",
    "member-channels",
  ]);

  const [isCreateChannelDialogOpen, setCreateChannelDialogOpen] =
    React.useState(false);

  const memberChannels = useMemberChannels({ readStates: true });

  const starredChannels = useStarredChannels({ readStates: true });

  const memberChannelsExcludingStarred = React.useMemo(() => {
    const starredChannelIds = starredChannels.map((c) => c.id);
    return memberChannels.filter((c) => !starredChannelIds.includes(c.id));
  }, [memberChannels, starredChannels]);

  const unseenChannels = memberChannels.filter(
    (c) => c.hasBeenSeen === false && c.id !== params.channelId
  );

  const popularPublicChannels = usePublicChannels().filter(
    (c) => c.memberUserIds.length >= 3
  );

  const listedChannels =
    authenticationStatus === "authenticated"
      ? [
          ...starredChannels,
          ...memberChannelsExcludingStarred,
          ...(memberChannels.length === 0 ? popularPublicChannels : []),
        ]
      : popularPublicChannels;

  const selectedChannel = useChannel(params.channelId);

  const selectedChannelIsListed = listedChannels.some(
    (c) => c.id === params.channelId
  );

  const isLoadingUser =
    authenticationStatus === "authenticated" && user == null;

  const hasFetchedMenuData = useHasFetchedMenuData();

  const toggleMenu = useSidebarToggle();
  const { isFloating: isMenuFloating, isCollapsed: isMenuCollapsed } =
    useSidebarState();

  return (
    <SidebarLayout
      header={({ isHoveringSidebar }) =>
        authenticationStatus === "not-authenticated" &&
        walletAccountAddress == null ? null : isLoadingUser ? (
          <div />
        ) : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <ProfileDropdownTrigger
                isConnecting={
                  authenticationStatus === "authenticated" &&
                  !serverConnectionState.isConnected
                }
                user={user ?? { walletAddress: walletAccountAddress }}
                subtitle={
                  authenticationStatus === "not-authenticated"
                    ? "Unverified account"
                    : null
                }
                toggleMenu={
                  isMenuFloating || (!isMenuCollapsed && isHoveringSidebar)
                    ? toggleMenu
                    : null
                }
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              side="bottom"
              align="center"
              sideOffset={0}
              alignOffset={0}
              css={(theme) =>
                css({ width: `calc(${theme.sidebarWidth} - 2rem)` })
              }
            >
              {authenticationStatus === "not-authenticated" ? (
                <>
                  <DropdownMenu.Item
                    onSelect={() => {
                      login(walletAccountAddress);
                    }}
                    css={(t) => css({ color: t.colors.link })}
                  >
                    Verify account
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      alert("Just switch account from your wallet!");
                    }}
                  >
                    Switch to another account
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item disabled>Settings</DropdownMenu.Item>
                  <DropdownMenu.Item disabled>Edit profile</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      navigator.clipboard.writeText(user.walletAddress);
                    }}
                  >
                    Copy wallet address
                  </DropdownMenu.Item>
                </>
              ) : (
                <>
                  <DropdownMenu.Item disabled>Settings</DropdownMenu.Item>
                  <DropdownMenu.Item disabled>Edit profile</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      navigator.clipboard.writeText(user.walletAddress);
                    }}
                  >
                    Copy wallet address
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onSelect={() => {
                      alert("Just switch account from your wallet!");
                    }}
                  >
                    Switch to another account
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onSelect={() => {
                      actions.logout();
                    }}
                  >
                    Log out
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )
      }
      sidebarContent={
        isLoadingUser ? null : (
          <>
            <div
              style={{
                height:
                  authenticationStatus === "not-authenticated" &&
                  walletAccountAddress == null
                    ? "2rem"
                    : "1rem",
              }}
            />
            <ListItem
              compact={false}
              icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
              title="Search"
              onClick={() => {
                openCommandCenter();
              }}
            />
            <ListItem
              compact={false}
              icon={
                <PlusSmallIcon style={{ width: "1.6rem", height: "auto" }} />
              }
              title="New channel"
              onClick={() => {
                setCreateChannelDialogOpen(true);
                if (isMenuFloating) toggleMenu();
              }}
            />

            {(authenticationStatus === "not-authenticated" ||
              hasFetchedMenuData) && (
              <>
                <div style={{ marginBottom: "1.5rem" }} />
                {selectedChannel != null && !selectedChannelIsListed && (
                  <>
                    <ChannelItem id={selectedChannel.id} />

                    <div style={{ marginBottom: "1.5rem" }} />
                  </>
                )}

                {unseenChannels.length !== 0 && (
                  <>
                    {unseenChannels.map((c) => (
                      <ChannelItem key={c.id} id={c.id} />
                    ))}

                    <div style={{ marginBottom: "1.5rem" }} />
                  </>
                )}

                {[
                  {
                    key: "starred",
                    title: "Starred",
                    channels: starredChannels,
                    isHidden: starredChannels.length === 0,
                  },
                  {
                    key: "member-channels",
                    title: "Channels",
                    channels: memberChannelsExcludingStarred,
                    isHidden: memberChannelsExcludingStarred.length === 0,
                  },
                  {
                    key: "public",
                    title: "Popular channels",
                    channels: sort(
                      comparator(
                        {
                          value: (c) => c.memberUserIds.length,
                          order: "desc",
                        },
                        { value: (c) => c.name.toLowerCase() }
                      ),
                      popularPublicChannels
                    ),
                    isHidden:
                      memberChannels.length !== 0 ||
                      popularPublicChannels.length === 0,
                  },
                ]
                  .filter((s) => !s.isHidden)
                  .map(({ key, title, channels }) => {
                    const isTruncated = truncatedSections.includes(key);

                    const deriveTruncationCount = () => {
                      if (!isTruncated) return 0;

                      const defaultTruncationCount =
                        channels.length - TRUNCATION_THRESHOLD;
                      const readCount = channels.filter(
                        (c) => !c.hasUnread
                      ).length;

                      return Math.min(defaultTruncationCount, readCount);
                    };

                    const truncationCount = deriveTruncationCount();

                    const visibleChannels =
                      isTruncated && truncationCount > 1
                        ? channels.slice(0, channels.length - truncationCount)
                        : channels;

                    return (
                      <CollapsableSection
                        key={key}
                        title={title}
                        expanded={!collapsedIds.includes(key)}
                        truncatedCount={
                          channels.length - visibleChannels.length
                        }
                        onToggleExpanded={() => {
                          setCollapsedIds((ids) =>
                            ids.includes(key)
                              ? ids.filter((id) => id !== key)
                              : [...ids, key]
                          );
                          setTruncatedSections((ids) =>
                            ids.includes(key) ? ids : [...ids, key]
                          );
                        }}
                        onToggleTruncated={() => {
                          setTruncatedSections((ids) =>
                            ids.includes(key)
                              ? ids.filter((id) => id !== key)
                              : [...ids, key]
                          );
                        }}
                      >
                        {visibleChannels.map((c) => (
                          <ChannelItem key={c.id} id={c.id} />
                        ))}
                      </CollapsableSection>
                    );
                  })}

                <div style={{ height: "0.1rem" }} />
              </>
            )}
          </>
        )
      }
    >
      <React.Suspense fallback={null}>
        <Outlet />
      </React.Suspense>

      <CreateChannelDialog
        isOpen={isCreateChannelDialogOpen}
        close={() => {
          setCreateChannelDialogOpen(false);
        }}
      />
    </SidebarLayout>
  );
};

const ProfileDropdownTrigger = React.forwardRef(
  ({ isConnecting, user, subtitle, toggleMenu, ...props }, ref) => {
    const { data: userEnsName } = useEnsName({ address: user.walletAddress });

    const theme = useTheme();

    const truncatedAddress =
      user?.walletAddress == null ? null : truncateAddress(user.walletAddress);

    const userDisplayName =
      user == null
        ? null
        : user.hasCustomDisplayName
        ? user.displayName
        : userEnsName ?? truncatedAddress;

    const showAccountDescription = userDisplayName !== truncatedAddress;
    const accountDescription =
      userEnsName == null || userEnsName === userDisplayName
        ? truncatedAddress
        : `${userEnsName} (${truncatedAddress})`;

    return (
      <button
        ref={ref}
        css={(theme) =>
          css({
            width: "100%",
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr) auto",
            gridGap: "0.8rem",
            alignItems: "center",
            padding: "0.2rem 1.4rem",
            height: "100%",
            cursor: "pointer",
            transition: "20ms ease-in",
            outline: "none",
            ":hover": {
              background: theme.colors.backgroundModifierHover,
            },
            ":focus-visible": {
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
            ".dropdown-icon": {
              display: toggleMenu == null ? "block" : "none",
            },
            ":hover .dropdown-icon, :focus .dropdown-icon": {
              display: "block",
            },
          })
        }
        {...props}
      >
        <div
          css={css({
            width: "2.2rem",
            height: "2.2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1px",
          })}
        >
          <div
            style={{
              userSelect: "none",
              display: "flex",
              alignCtems: "center",
              justifyContent: "center",
              height: "2rem",
              width: "2rem",
              marginTop: "1px",
            }}
          >
            {isConnecting ? (
              <Spinner size="1.8rem" color={theme.colors.textMuted} />
            ) : (
              <UserAvatar
                transparent
                walletAddress={user?.walletAddress}
                size="1.8rem"
              />
            )}
          </div>
        </div>
        <div>
          <div
            css={(theme) =>
              css({
                color: theme.colors.textNormal,
                fontSize: theme.fontSizes.default,
                fontWeight: theme.text.weights.header,
                lineHeight: "2rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {userDisplayName}
            {showAccountDescription && subtitle != null && (
              <>
                {" "}
                <span
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.small,
                      fontWeight: "400",
                      lineHeight: "1.2rem",
                    })
                  }
                >
                  ({truncatedAddress})
                </span>
              </>
            )}
          </div>
          {(subtitle != null || showAccountDescription) && (
            <div
              css={(theme) =>
                css({
                  color: theme.colors.textDimmed,
                  fontSize: theme.fontSizes.small,
                  fontWeight: "400",
                  lineHeight: "1.2rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })
              }
            >
              {subtitle ?? accountDescription}
            </div>
          )}
        </div>
        <div css={css({ display: "flex", alignItems: "center" })}>
          <div
            css={css({ width: "1.2rem", height: "1.2rem" })}
            className="dropdown-icon"
          >
            <svg
              viewBox="-1 -1 9 11"
              style={{ width: "100%", height: "100%" }}
              css={(theme) => css({ fill: theme.colors.textMuted })}
            >
              <path d="M 3.5 0L 3.98809 -0.569442L 3.5 -0.987808L 3.01191 -0.569442L 3.5 0ZM 3.5 9L 3.01191 9.56944L 3.5 9.98781L 3.98809 9.56944L 3.5 9ZM 0.488094 3.56944L 3.98809 0.569442L 3.01191 -0.569442L -0.488094 2.43056L 0.488094 3.56944ZM 3.01191 0.569442L 6.51191 3.56944L 7.48809 2.43056L 3.98809 -0.569442L 3.01191 0.569442ZM -0.488094 6.56944L 3.01191 9.56944L 3.98809 8.43056L 0.488094 5.43056L -0.488094 6.56944ZM 3.98809 9.56944L 7.48809 6.56944L 6.51191 5.43056L 3.01191 8.43056L 3.98809 9.56944Z" />
            </svg>
          </div>
          {toggleMenu != null && (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                toggleMenu();
              }}
              css={(t) =>
                css({
                  width: "2.4rem",
                  height: "2.4rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "0.7rem",
                  marginRight: "-0.4rem",
                  borderRadius: "0.3rem",
                  color: t.colors.textMuted,
                  ":hover": {
                    color: t.colors.textNormal,
                    background: t.colors.backgroundModifierHover,
                  },
                })
              }
            >
              <DoubleChevronLeftIcon
                css={css({
                  position: "relative",
                  right: "1px",
                  width: "1.6rem",
                  height: "1.6rem",
                })}
              />
            </div>
          )}
        </div>
      </button>
    );
  }
);

const CollapsableSection = ({
  title,
  expanded,
  truncatedCount = 0,
  onToggleExpanded,
  onToggleTruncated,
  children,
}) => (
  <section style={{ marginBottom: expanded ? "1.8rem" : 0 }}>
    <div
      css={(t) =>
        css({
          margin: "0.6rem 0 0.2rem",
          padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
          minHeight: "2.4rem",
          display: "grid",
          alignItems: "center",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gridGap: "1rem",
        })
      }
    >
      <button
        onClick={onToggleExpanded}
        css={(theme) =>
          css({
            lineHeight: 1,
            padding: "0.2rem 0.4rem",
            marginLeft: "-0.4rem",
            color: "rgb(255 255 255 / 28.2%)",
            transition: "background 20ms ease-in, color 100ms ease-out",
            borderRadius: "0.3rem",
            cursor: "pointer",
            justifySelf: "flex-start",
            outline: "none",
            ":hover": {
              color: "rgb(255 255 255 / 56.5%)",
              background: theme.colors.backgroundModifierHover,
            },
            ":focus-visible": {
              color: "rgb(255 255 255 / 56.5%)",
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
          })
        }
      >
        <SmallText>{title}</SmallText>
      </button>
    </div>

    {expanded && (
      <>
        {children}
        {truncatedCount > 0 && (
          <ListItem
            component="button"
            onClick={onToggleTruncated}
            title={
              <SmallText css={css({ padding: "0 0.4rem" })}>
                {truncatedCount} more...
              </SmallText>
            }
          />
        )}
      </>
    )}
  </section>
);

const SmallText = ({ component: Component = "div", ...props }) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.fontSizes.small,
        fontWeight: "600",
        lineHeight: 1,
        color: "rgb(255 255 255 / 28.2%)",
      })
    }
    {...props}
  />
);

const ChannelItem = ({ id, expandable }) => {
  const theme = useTheme();
  const name = useChannelName(id);
  const link = `/channels/${id}`;
  const hasUnread = useChannelHasUnread(id);
  const notificationCount = useChannelMentionCount(id);

  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  const avatarProps = {
    transparent: true,
    size: theme.avatars.size,
    borderRadius: theme.avatars.borderRadius,
    background: theme.colors.backgroundModifierHover,
  };

  return (
    <ListItem
      expandable={expandable}
      component={NavLink}
      to={link}
      className={({ isActive }) => (isActive ? "active" : "")}
      onClick={closeMenu}
      notificationCount={notificationCount}
      title={
        <>
          <div
            className="title"
            css={(theme) =>
              css({
                color: hasUnread ? theme.colors.textNormal : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {name}
            {/* {(name ?? "") === "" ? ( */}
            {/*   <div */}
            {/*     css={(theme) => */}
            {/*       css({ */}
            {/*         width: "100%", */}
            {/*         height: "1.5rem", */}
            {/*         background: theme.colors.backgroundModifierHover, */}
            {/*         borderRadius: "0.3rem", */}
            {/*       }) */}
            {/*     } */}
            {/*   /> */}
            {/* ) : ( */}
            {/*   name */}
            {/* )} */}
          </div>
        </>
      }
      icon={
        <span>
          <ChannelAvatar id={id} {...avatarProps} />
        </span>
      }
    />
  );
};

const ListItem = ({
  component: Component = "button",
  expandable,
  expanded,
  compact = true,
  onToggleExpanded,
  indendationLevel = 0,
  icon,
  title,
  notificationCount,
  disabled,
  ...props
}) => (
  <div
    css={(theme) => css`
      padding: 0 ${theme.mainMenu.containerHorizontalPadding};

      &:not(:last-of-type) {
        margin-bottom: ${theme.mainMenu.itemDistance};
      }
      & > * {
        display: flex;
        align-items: center;
        width: 100%;
        border: 0;
        font-size: ${theme.fontSizes.default};
        font-weight: ${theme.mainMenu.itemTextWeight};
        text-align: left;
        background: transparent;
        border-radius: ${theme.mainMenu.itemBorderRadius};
        cursor: pointer;
        outline: none;
        color: ${disabled
          ? theme.mainMenu.itemTextColorDisabled
          : theme.mainMenu.itemTextColor};
        padding: 0.2rem ${theme.mainMenu.itemHorizontalPadding};
        padding-left: calc(
          ${theme.mainMenu.itemHorizontalPadding} + ${indendationLevel} * 2.2rem
        );
        text-decoration: none;
        line-height: 1.3;
        height: ${theme.mainMenu.itemHeight};
        margin: 0.1rem 0;
        pointer-events: ${disabled ? "none" : "all"};
      }
      & > *.active,
      & > *:not(.active):hover {
        background: ${theme.colors.backgroundModifierHover};
      }
      & > *.active {
        color: ${theme.colors.textNormal};
      }
      & > *:focus-visible {
        box-shadow: 0 0 0 0.2rem ${theme.colors.primary};
      }
    `}
  >
    <Component {...props}>
      {expandable && (
        <div
          css={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.2rem",
            height: "2.2rem",
          })}
          style={{ marginRight: icon == null ? "0.4rem" : 0 }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              onToggleExpanded();
            }}
            css={(theme) =>
              css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2rem",
                height: "2rem",
                color: theme.colors.textMuted,
                borderRadius: "0.3rem",
                transition: "background 20ms ease-in",
                ":hover": {
                  background: theme.colors.backgroundModifierHover,
                },
              })
            }
          >
            <TriangleIcon
              style={{
                transition: "transform 200ms ease-out",
                transform: `rotate(${expanded ? "180deg" : "90deg"})`,
                width: "0.963rem",
              }}
            />
          </div>
        </div>
      )}
      {icon != null && (
        <div
          css={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.2rem",
            height: "1.8rem",
            marginRight: compact ? "0.4rem" : "0.8rem",
          })}
        >
          <div
            css={(theme) =>
              css({
                color: disabled
                  ? "rgb(255 255 255 / 22%)"
                  : theme.colors.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2rem",
                height: "2rem",
              })
            }
          >
            {icon}
          </div>
        </div>
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </div>
      {notificationCount > 0 && <NotificationBadge count={notificationCount} />}
    </Component>
  </div>
);

export default Layout;
