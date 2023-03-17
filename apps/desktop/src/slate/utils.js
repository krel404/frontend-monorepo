import { Editor, Path, Text } from "slate";
import { function as functionUtils } from "@shades/common/utils";

const { compose } = functionUtils;

export const mergePlugins = (plugins) => {
  const middleware = compose(
    ...plugins.filter((p) => p.middleware != null).map((p) => p.middleware)
  );

  const elements = plugins.reduce(
    (acc, p) => (p.elements == null ? acc : { ...acc, ...p.elements }),
    []
  );

  const pipeEventHandler =
    (handler) =>
    (e, ...rest) => {
      handler?.(e, ...rest);
      return e;
    };

  const handlers = {
    onChange: compose(
      ...plugins.map((p) => pipeEventHandler(p.handlers?.onChange))
    ),
    onKeyDown: compose(
      ...plugins.map((p) => pipeEventHandler(p.handlers?.onKeyDown))
    ),
  };

  return { middleware, elements, handlers };
};

export const isNodeEmpty = (el) => {
  if (el.type === "user") return false;
  if (el.type === "channel-link") return false;
  if (el.type === "attachments") return false;
  if (el.type === "link") return false;
  if (el.children != null) return el.children.every(isNodeEmpty);
  return el.text.trim() === "";
};

export const cleanNodes = (nodes) =>
  nodes.reduce((acc, n) => {
    if (isNodeEmpty(n)) return acc;
    if (n.type === "link") return [...acc, { type: "link", url: n.url }];
    if (n.type === "user") return [...acc, { type: "user", ref: n.ref }];
    if (n.type === "channel-link")
      return [...acc, { type: "channel-link", ref: n.ref }];
    if (n.children == null) return [...acc, n];
    return [...acc, { ...n, children: cleanNodes(n.children) }];
  }, []);

export const normalizeNodes = (nodes) =>
  nodes.reduce((acc, n) => {
    if (n.type === "link")
      return [...acc, { ...n, children: [{ text: n.url }] }];
    if (n.type === "user" || n.type === "channel-link")
      return [...acc, { ...n, children: [{ text: "" }] }, { text: "" }];
    // TODO implement plugin "unsupported-element"
    if (n.children == null && n.text == null)
      return [...acc, { ...n, text: "" }];
    if (n.children == null) return [...acc, n];
    return [...acc, { ...n, children: normalizeNodes(n.children) }];
  }, []);

export const search = (editor, query, options = {}) => {
  const at = options.at ?? editor.selection ?? [];

  const [atStart, atEnd] = Editor.edges(editor, at);

  let start, end;

  let text = "";

  for (const [node, path] of Editor.nodes(editor, {
    at,
    match: Text.isText,
  })) {
    let t = node.text;

    if (Path.equals(path, atEnd.path)) t = t.slice(0, atEnd.offset);
    if (Path.equals(path, atStart.path)) t = t.slice(atStart.offset);

    const prevLength = text.length;

    text = text + t;

    const index = text.indexOf(query);

    if (index !== -1) {
      const offset = index - prevLength + query.length;
      end = { path, offset };
      break;
    }
  }

  if (end == null) return null;

  text = "";

  for (const [node, path] of Editor.nodes(editor, {
    at: { anchor: atStart, focus: end },
    match: Text.isText,
    reverse: true,
  })) {
    let t = node.text;

    if (Path.equals(path, atEnd.path)) t = t.slice(0, atEnd.offset);
    if (Path.equals(path, atStart.path)) t = t.slice(atStart.offset);

    text = t + text;

    const index = text.indexOf(query);

    if (index !== -1) {
      start = { path, offset: index };
      break;
    }
  }

  return [start, end];
};

export const getWords = ([node, path]) => {
  if (!Text.isText(node)) return [];

  let offset = 0;
  const wordEntries = [];

  for (let wordString of node.text.split(/\s+/)) {
    if (wordString === "") {
      offset += 1;
      continue;
    }

    wordEntries.push([
      wordString,
      {
        anchor: { path, offset },
        focus: { path, offset: offset + wordString.length },
      },
    ]);

    offset += wordString.length + 1;
  }

  return wordEntries;
};
