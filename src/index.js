import { extname } from "path";
import { platform } from "os";
import svgo from "svgo";

import { createFilter } from "rollup-pluginutils";
import Svelte from "svelte/compiler";

// Possible values are 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'.
// https://nodejs.org/api/os.html#os_os_platform
const isWindows = platform() === "win32";

const toSvelte = (svgStart, svgBody) => `<script>export let elemRef = undefined</script>${svgStart} bind:this={elemRef} {...$$props} ${svgBody}`;

const head = xs => xs[0];
const tail = xs => xs[xs.length - 1];

const validJS = /[a-zA-Z_$][0-9a-zA-Z_$]*/;

const toJSClass = text =>
	text
		.split("-")
		// Uppercase first character of every segment after splitting out hyphens
		.map(segment => (segment ? segment[0].toUpperCase() + segment.slice(1) : segment))
		.join("")
		// split into characters
		.split("")
		// drop potentially unsafe characters
		.map(x => (validJS.test(x) ? x : ""))
		.join("");

export default function svg(options = {}) {
	const filter = createFilter(options.include, options.exclude);

	return {
		name: "svg",
		transform(source, id) {
			if (!filter(id) || extname(id) !== ".svg") {
				return null;
			}

			function process(source) {
				const svgRegex = new RegExp("(<svg.*?)(/?>.*)", "gs");
				const parts = svgRegex.exec(source);
				if (!parts) {
					throw new Error(
						"svg file did not start with <svg> tag. Unable to convert to Svelte component"
					);
				}
				const [, svgStart, svgBody] = parts;
				const content = toSvelte(svgStart, svgBody);
				const {
					js: { code, map },
				} = Svelte.compile(content, {
					filename: id,
					name: toJSClass(head(tail(id.split(isWindows ? "\\" : "/")).split("."))),
					format: "esm",
					generate: options.generate,
					hydratable: true,
					dev: options.dev,
				});

				return { code, map };
			}			

			if (options.svgo) {
				// transform the source with SVGO
				const SVGO = new svgo(options.svgo);
				return SVGO.optimize(source).then(({ data }) => process(data))
			} else {
				return process(source)
			}
		},
	};
}
