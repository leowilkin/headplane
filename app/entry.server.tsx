import { PassThrough } from 'node:stream';

import type { AppLoadContext, EntryContext } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { ServerRouter } from 'react-router';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';

import { loadContext } from './utils/config/headplane';

await loadContext();

export const streamTimeout = 5000;
export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	reactRouterContext: EntryContext,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_loadContext: AppLoadContext,
) {
	const ua = request.headers.get('user-agent');
	const isBot = ua ? isbot(ua) : false;

	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const { pipe, abort } = renderToPipeableStream(
			<ServerRouter context={reactRouterContext} url={request.url} />,
			{
				[isBot ? 'onAllReady' : 'onShellReady']() {
					shellRendered = true;
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);
					responseHeaders.set('Content-Type', 'text/html');

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error as Error);
				},
				onError(error: unknown) {
					responseStatusCode = 500;
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);

		setTimeout(abort, streamTimeout + 1000);
	});
}
