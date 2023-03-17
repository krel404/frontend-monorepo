import React from "react";
import { useAuth } from "./auth";
import { useServerMessageHandler } from "./store";
import { useLatestCallback } from "./react";
import { useMe } from "./hooks/me";

const serverEventMap = {
  MESSAGE_CREATE: "message-created",
  MESSAGE_UPDATE: "message-updated",
  MESSAGE_REMOVE: "message-removed",
  MESSAGE_REACTION_ADD: "message-reaction-added",
  MESSAGE_REACTION_REMOVE: "message-reaction-removed",
  USER_PROFILE_UPDATE: "user-profile-updated",
  USER_PRESENCE_UPDATE: "user-presence-updated",
  USER_TYPING: "user-typed",
  CHANNEL_READ: "channel-read",
  CHANNEL_UPDATE: "channel-updated",
  CHANNEL_USER_JOINED: "channel-user-joined",
  CHANNEL_USER_INVITED: "channel-user-invited",
};

const initPusherConnection = ({ Pusher, key, accessToken, apiOrigin }) => {
  const pusher = new Pusher(key, {
    cluster: "eu",
    authEndpoint: `${apiOrigin}/websockets/auth`,
    auth: {
      params: { provider: "pusher" },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return new Promise((resolve) => {
    pusher.connection.bind("connected", () => {
      resolve(pusher);
    });
  });
};

const Context = React.createContext(null);

export const Provider = ({ Pusher, pusherKey, debug = false, children }) => {
  const handleServerMessage = useServerMessageHandler();
  const { accessToken, apiOrigin } = useAuth();

  const user = useMe();

  const pusherRef = React.useRef();
  const channelRef = React.useRef();
  const listenersRef = React.useRef([]);

  const [pusherState, setPusherState] = React.useState(null);

  const addListener = React.useCallback((fn) => {
    listenersRef.current = [...listenersRef.current, fn];
    return () => {
      listenersRef.current = listenersRef.current.filter((fn_) => fn !== fn_);
    };
  }, []);

  React.useEffect(() => {
    if (accessToken == null || user?.id == null) return;
    Pusher.logToConsole = debug;

    const connect = async () => {
      const pusher = await initPusherConnection({
        Pusher,
        key: pusherKey,
        accessToken,
        apiOrigin,
      });

      if (pusherRef.current != null) {
        pusherRef.current.connection.unbind("state_change");
        pusherRef.current.disconnect();
      }

      pusherRef.current = pusher;
      channelRef.current = pusher.subscribe(`private-${user.id}`);

      for (let event of Object.keys(serverEventMap))
        channelRef.current.bind(event, (data) => {
          const clientEventName = serverEventMap[event];
          listenersRef.current.forEach((fn) => fn(clientEventName, data));
        });

      pusher.connection.bind("state_change", ({ current }) => {
        setPusherState(current);
      });

      setPusherState(pusher.connection.state);
    };

    connect();
  }, [Pusher, apiOrigin, pusherKey, debug, user?.id, accessToken]);

  React.useEffect(() => {
    const removeListener = addListener(handleServerMessage);
    return () => {
      removeListener();
    };
  }, [handleServerMessage, addListener]);

  const serverConnection = React.useMemo(
    () => ({ addListener, isConnected: pusherState === "connected" }),
    [addListener, pusherState]
  );

  return (
    <Context.Provider value={serverConnection}>{children}</Context.Provider>
  );
};

export const useServerEventListener = (listener_) => {
  const serverConnection = React.useContext(Context);

  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    const removeListener = serverConnection.addListener(listener);
    return () => {
      removeListener();
    };
  }, [listener, serverConnection]);
};

export const useServerConnectionState = () => {
  const { isConnected } = React.useContext(Context);
  return { isConnected };
};
