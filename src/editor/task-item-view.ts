import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView, ViewMutationRecord } from "prosemirror-view";

// A declarative toDOM (in schema.ts) can render a checkbox, but clicking a
// plain <input> wouldn't persist back into the ProseMirror doc — only a
// NodeView can intercept the click and dispatch a transaction that actually
// updates the `checked` attr.
export class TaskItemView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private checkbox: HTMLInputElement;

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.dom = document.createElement("li");
    this.dom.setAttribute("data-task", "1");

    this.checkbox = document.createElement("input");
    this.checkbox.type = "checkbox";
    this.checkbox.checked = !!node.attrs.checked;
    this.checkbox.addEventListener("mousedown", (event) => event.preventDefault());
    this.checkbox.addEventListener("change", () => {
      const pos = getPos();
      if (typeof pos !== "number") return;
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { checked: this.checkbox.checked }));
    });
    this.dom.appendChild(this.checkbox);

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "task-item-content";
    this.dom.appendChild(this.contentDOM);
  }

  update(node: PMNode): boolean {
    if (node.type.name !== "task_item") return false;
    this.checkbox.checked = !!node.attrs.checked;
    return true;
  }

  ignoreMutation(record: ViewMutationRecord): boolean {
    return record.target === this.checkbox;
  }
}
