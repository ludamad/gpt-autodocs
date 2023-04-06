export const FUNC_PROMPT = (
  name: string
) => `Provide ONLY an insightful jsdoc comment for the '${name}' function delimited by /** and */.
Example: 
/**
 * Create an AztecAddress instance from a hex-encoded string.
 * The input 'address' should be prefixed with '0x' or not, and have exactly 64 hex characters.
 * Throws an error if the input length is invalid or address value is out of range.
 *
 * @param address - The hex-encoded string representing the Aztec address.
 * @returns An AztecAddress instance.
 */`;

export const CLASS_PROMPT = (
  name: string
) => `Provide ONLY an insightful jsdoc comment for the '${name}' class delimited by /** and */.
Example: 

/**
 * A TransportClient provides a request/response and event api to a corresponding TransportServer.
 * If \`broadcast\` is called on TransportServer, TransportClients will emit an \`event_msg\`.
 * The \`request\` method will block until a response is returned from the TransportServer's dispatch function.
 * Request multiplexing is supported.
 */`;

export const FIELD_PROMPT = (
  name: string
) => `Provide ONLY a brief but insightful jsdoc comment for the '${name}' field delimited by /** and */.
Example: 

/**
 * A source of L2 data.
 */`;

export const INTERFACE_PROMPT = (
  name: string
) => `Provide ONLY an insightful jsdoc comment for the '${name}' interface delimited by /** and */.
Example: 

/**
 * Represents an aztec RPC implementation.
 * Provides functionality for all the operations needed to use the Aztec network.
 */`;

export const TYPE_PROMPT = (
  name: string
) => `Provide ONLY an insightful jsdoc comment for the '${name}' type delimited by /** and */.
Example: 

/**
 * Type for all asynchronous callbacks.
 */`;
