import React from "react";
import { mapValues } from "../utils/object";
import combineReducers from "../utils/combine-reducers";
import me, { selectMe } from "../reducers/me";
import ui, {
  selectHasFetchedInitialData,
  selectHasFetchedMenuData,
} from "../reducers/ui";
import channels, {
  selectChannel,
  selectMemberChannels,
  selectDmChannels,
  selectTopicChannels,
  selectStarredChannels,
  selectDmAndTopicChannels,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectHasAllMessages,
  selectHasFetchedMessages,
  selectChannelHasUnread,
  selectChannelMentionCount,
  selectChannelStarId,
  selectIsChannelStarred,
  selectChannelMembers,
  selectChannelAccessLevel,
} from "../reducers/channels";
import messages, {
  selectMessage,
  selectChannelMessages,
} from "../reducers/messages";
import users, {
  selectUser,
  selectUsers,
  selectUserFromWalletAddress,
} from "../reducers/users";
import channelTypingStatus, {
  selectChannelTypingMembers,
} from "../reducers/channel-typing-status";
import apps, { selectApp } from "../reducers/apps";

const selectors = {
  selectMe,
  selectChannel,
  selectChannelMembers,
  selectChannelAccessLevel,
  selectMemberChannels,
  selectDmChannels,
  selectTopicChannels,
  selectDmAndTopicChannels,
  selectStarredChannels,
  selectMessage,
  selectChannelMessages,
  selectUser,
  selectUsers,
  selectUserFromWalletAddress,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectHasFetchedInitialData,
  selectChannelTypingMembers,
  selectHasAllMessages,
  selectHasFetchedMessages,
  selectChannelHasUnread,
  selectChannelMentionCount,
  selectChannelStarId,
  selectIsChannelStarred,
  selectApp,
  selectHasFetchedMenuData,
};

const rootReducer = combineReducers({
  me,
  channels,
  users,
  messages,
  channelTypingStatus,
  apps,
  ui,
});

const initialState = rootReducer(undefined, {});

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector.bind(null, state), selectors);

const useRootReducer = () => {
  const [state, dispatch_] = React.useReducer(rootReducer, initialState);

  const beforeDispatchListenersRef = React.useRef([]);
  const afterDispatchListenersRef = React.useRef([]);

  const addBeforeDispatchListener = React.useCallback((fn) => {
    beforeDispatchListenersRef.current.push(fn);

    return () => {
      beforeDispatchListenersRef.current.filter((fn_) => fn_ !== fn);
    };
  }, []);

  const addAfterDispatchListener = React.useCallback((fn) => {
    afterDispatchListenersRef.current.push(fn);

    return () => {
      afterDispatchListenersRef.current.filter((fn_) => fn_ !== fn);
    };
  }, []);

  const dispatch = React.useCallback((action) => {
    for (let callback of beforeDispatchListenersRef.current) callback(action);
    const result = dispatch_(action);
    for (let callback of afterDispatchListenersRef.current) callback(action);
    return result;
  }, []);

  const appliedSelectors = React.useMemo(
    () => applyStateToSelectors(selectors, state),
    [state]
  );

  return [
    appliedSelectors,
    dispatch,
    { addBeforeDispatchListener, addAfterDispatchListener },
  ];
};

export default useRootReducer;
