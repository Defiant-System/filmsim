
// vermeer.box.adjust

{
	els: {},
	toggle(root, state) {
		if (state === "on") {
			// fast references
			this.els.root = root;
		} else {
			// clean up
			this.els = {};
		}
	},
	dispatch(event) {
		let APP = vermeer,
			Self = APP.box.adjust,
			el;

		switch (event.type) {
			// custom events
			case "custom-event":
				break;
		}
	}
}