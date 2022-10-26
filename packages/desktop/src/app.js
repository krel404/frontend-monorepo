import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import React from "react";
import { OverlayProvider } from "react-aria";
import { css } from "@emotion/react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { IntlProvider } from "react-intl";
import { ThemeProvider, Global } from "@emotion/react";
import Pusher from "pusher-js";
import {
  useAuth,
  AuthProvider,
  useAppScope,
  useServerConnection,
  AppScopeProvider,
  ServerConnectionProvider,
} from "@shades/common/app";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import { IFrameEthereumProvider } from "@newshades/iframe-provider";
import { Provider as GlobalMediaQueriesProvider } from "./hooks/global-media-queries";
import { send as sendNotification } from "./utils/notifications";
import useWindowFocusListener from "./hooks/window-focus-listener";
import useOnlineListener from "./hooks/window-online-listener";
import { Provider as SideMenuProvider } from "./hooks/side-menu";
import useWalletEvent from "./hooks/wallet-event";
import useWalletLogin, {
  Provider as WalletLoginProvider,
} from "./hooks/wallet-login";
import LoginScreen from "./components/login-screen";
import Channel, { Header as ChannelHeader } from "./components/channel";
// import Discover from "./components/discover";
// import JoinServer from "./components/join-server";
import { UnifiedLayout } from "./components/layouts";
import TitleBar from "./components/title-bar";
import * as Tooltip from "./components/tooltip";
import { Home as HomeIcon } from "./components/icons";
import { notion as defaultTheme, nounsTv as nounsTvTheme } from "./themes";
import AuthHome from "./components/auth";

const { unique } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const isNative = window.Native != null;
const isReactNativeWebView = window.ReactNativeWebView != null;

const isIFrame = window.parent && window.self && window.parent !== window.self;
if (isIFrame) window.ethereum = new IFrameEthereumProvider();

const { chains, provider } = configureWagmiChains(
  [mainnetChain],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  connectors: [
    new InjectedConnector({
      chains,
      options: { isIFrame },
    }),
    new WalletConnectConnector({
      chains,
      options: { qrcode: true },
    }),
  ],
});

const useSystemNotifications = () => {
  const navigate = useNavigate();
  const { state, addAfterDispatchListener } = useAppScope();

  const user = state.selectMe();

  const afterDispatchListener = useLatestCallback((action) => {
    switch (action.type) {
      case "server-event:message-created": {
        const message = state.selectMessage(action.data.message.id);

        if (message.authorUserId === user.id) break;

        const hasUnread = state.selectChannelHasUnread(message.channelId);

        if (!hasUnread) break;

        const channel = state.selectChannel(message.channelId);

        import("@shades/common/nouns").then((module) => {
          sendNotification({
            title: `Message from ${message.author.displayName}`,
            body: message.stringContent,
            icon:
              message.author.profilePicture.small ??
              module.generatePlaceholderAvatarDataUri(
                message.author.walletAddress,
                {
                  pixelSize: 24,
                }
              ),
            onClick: ({ close }) => {
              navigate(`/channels/${channel.id}`);
              window.focus();
              close();
            },
          });
        });

        break;
      }

      default: // Ignore
    }
  });

  React.useEffect(() => {
    if (window.Notification?.permission !== "granted") return;
    const removeListener = addAfterDispatchListener(afterDispatchListener);
    return () => {
      removeListener();
    };
  }, [addAfterDispatchListener, afterDispatchListener]);
};

const useIFrameMessenger = () => {
  const { addAfterDispatchListener } = useAppScope();

  React.useEffect(() => {
    if (window === window.parent) return;

    const removeListener = addAfterDispatchListener((action) => {
      window.parent.postMessage({ action }, "*");
    });
    return () => {
      removeListener();
    };
  }, [addAfterDispatchListener]);
};

const App = () => {
  const navigate = useNavigate();

  const serverConnection = useServerConnection();
  const { status: authStatus } = useAuth();
  const { state, actions, dispatch } = useAppScope();
  const { login } = useWalletLogin();

  const {
    fetchClientBootData,
    fetchUserChannels,
    fetchUserChannelsReadStates,
    fetchStarredItems,
    fetchUsers,
    fetchPubliclyReadableChannels,
  } = actions;

  const user = state.selectMe();

  useSystemNotifications();
  useIFrameMessenger();

  useWalletEvent("disconnect", () => {
    if (authStatus === "not-authenticated") return;
    if (!confirm("Wallet disconnected. Do you wish to log out?")) return;
    actions.logout();
    navigate("/");
  });

  useWalletEvent("account-change", (newAddress) => {
    if (
      // We only care about logged in users
      authStatus === "not-authenticated" ||
      user?.wallet_address.toLowerCase() === newAddress.toLowerCase()
    )
      return;

    // Suggest login with new account
    if (
      !confirm(
        `Do you wish to login as ${truncateAddress(newAddress)} instead?`
      )
    )
      return;

    actions.logout();
    login(newAddress).then(() => {
      navigate("/");
    });
  });

  React.useEffect(() => {
    let typingEndedTimeoutHandles = {};

    const handler = (name, data) => {
      // Dispatch a 'user-typing-ended' action when a user+channel combo has
      // been silent for a while
      if (name === "user-typed") {
        const id = [data.channel.id, data.user.id].join(":");

        if (typingEndedTimeoutHandles[id]) {
          clearTimeout(typingEndedTimeoutHandles[id]);
          delete typingEndedTimeoutHandles[id];
        }

        typingEndedTimeoutHandles[id] = setTimeout(() => {
          delete typingEndedTimeoutHandles[id];
          dispatch({
            type: "user-typing-ended",
            channelId: data.channel.id,
            userId: data.user.id,
          });
        }, 6000);
      }

      dispatch({ type: ["server-event", name].join(":"), data, user });
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [user, serverConnection, dispatch]);

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;

    fetchClientBootData().then(({ channels }) => {
      const dmUserIds = unique(
        channels.filter((c) => c.kind === "dm").flatMap((c) => c.members)
      );
      fetchUsers(dmUserIds);
    });
  }, [authStatus, fetchClientBootData, fetchUsers]);

  React.useEffect(() => {
    if (authStatus === "not-authenticated") fetchPubliclyReadableChannels();
  }, [authStatus, fetchPubliclyReadableChannels]);

  useWindowFocusListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  useOnlineListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  if (isReactNativeWebView) {
    const sendMessageToApp = (type, payload) =>
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
    return (
      <LoginScreen
        onSuccess={({ accessToken, refreshToken }) => {
          sendMessageToApp("ns:authenticated", { accessToken, refreshToken });
        }}
        onError={() => {
          sendMessageToApp("ns:error");
        }}
      />
    );
  }

  return (
    <>
      <Global
        styles={(theme) =>
          css({
            body: {
              color: theme.colors.textNormal,
              fontFamily: theme.fontStacks.default,
              "::selection": {
                background: theme.colors.textSelectionBackground,
              },
            },
          })
        }
      />

      {isNative && <TitleBar />}

      <Routes>
        <Route path="/" element={<UnifiedLayout />}>
          <Route index element={<EmptyHome />} />
          <Route path="/channels/:channelId" element={<Channel />} />
        </Route>
        <Route path="c/:channelId" element={<Channel noSideMenu />} />

        <Route
          path="/oauth/authorize"
          element={
            <RequireAuth>
              <AuthHome />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const EmptyHome = () => {
  const { status: authStatus } = useAuth();

  return (
    <div
      css={(theme) =>
        css({
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: theme.colors.backgroundPrimary,
        })
      }
    >
      <ChannelHeader />
      {authStatus === "not-authenticated" ? (
        <LoginScreen withMenu />
      ) : (
        <div
          css={css({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            })}
          >
            <HomeIcon
              style={{
                width: "6rem",
                color: "rgb(255 255 255 / 5%)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

const searchParams = new URLSearchParams(location.search);
const specifiedTheme = searchParams.get("theme");
const theme = specifiedTheme === "nouns-tv" ? nounsTvTheme : defaultTheme;

export default function Root() {
  return (
    <WagmiConfig client={wagmiClient}>
      <IntlProvider locale="en">
        <AuthProvider apiOrigin="/api">
          <AppScopeProvider>
            <ServerConnectionProvider
              Pusher={Pusher}
              pusherKey={process.env.PUSHER_KEY}
            >
              <WalletLoginProvider>
                <ThemeProvider theme={theme}>
                  <OverlayProvider style={{ width: "100%", height: "100%" }}>
                    <Tooltip.Provider delayDuration={300}>
                      <SideMenuProvider>
                        <GlobalMediaQueriesProvider>
                          <App />
                        </GlobalMediaQueriesProvider>
                      </SideMenuProvider>
                    </Tooltip.Provider>
                  </OverlayProvider>
                </ThemeProvider>
              </WalletLoginProvider>
            </ServerConnectionProvider>
          </AppScopeProvider>
        </AuthProvider>
      </IntlProvider>
    </WagmiConfig>
  );
}
