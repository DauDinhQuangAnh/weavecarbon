import { apiRequest, type ApiOptions } from "@/lib/apiClient";
import type { paths } from "./generated/backend";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
type ContractPath = keyof paths & string;
type PathsForMethod<Method extends HttpMethod> = {
  [Path in ContractPath]: Method extends keyof paths[Path] ? Path : never;
}[ContractPath];
type Operation<Method extends HttpMethod, Path extends PathsForMethod<Method>> =
  Method extends keyof paths[Path] ? paths[Path][Method] : never;

type OperationParameters<OperationType, Location extends "path" | "query"> =
  OperationType extends { parameters: infer Parameters }
    ? Location extends keyof Parameters
      ? NonNullable<Parameters[Location]>
      : never
    : never;

type OperationBody<OperationType> = OperationType extends {
  requestBody?: { content: { "application/json": infer Body } };
}
  ? NonNullable<Body>
  : never;

type OperationResponses<OperationType> = OperationType extends { responses: infer Responses }
  ? Responses
  : never;
type SuccessResponse<Responses> = "2XX" extends keyof Responses
  ? Responses["2XX"]
  : 200 extends keyof Responses
    ? Responses[200]
    : 201 extends keyof Responses
      ? Responses[201]
      : 202 extends keyof Responses
        ? Responses[202]
        : 204 extends keyof Responses
          ? Responses[204]
          : never;
type JsonContent<Response> = Response extends {
  content: { "application/json": infer Json };
}
  ? Json
  : never;
type UnwrappedPayload<Payload> = Payload extends { data: infer Data } ? Data : Payload;

export type OpenApiResult<
  Method extends HttpMethod,
  Path extends PathsForMethod<Method>
> = UnwrappedPayload<JsonContent<SuccessResponse<OperationResponses<Operation<Method, Path>>>>>;

type PathParameters<OperationType> = OperationParameters<OperationType, "path">;
type QueryParameters<OperationType> = OperationParameters<OperationType, "query">;
type PathOption<OperationType> = [PathParameters<OperationType>] extends [never]
  ? { path?: never }
  : { path: PathParameters<OperationType> };
type QueryOption<OperationType> = [QueryParameters<OperationType>] extends [never]
  ? { query?: never }
  : { query?: QueryParameters<OperationType> };
type BodyOption<OperationType> = [OperationBody<OperationType>] extends [never]
  ? { body?: never }
  : { body?: OperationBody<OperationType> };

export type OpenApiRequestOptions<OperationType> = Omit<
  ApiOptions,
  "body" | "method"
> &
  PathOption<OperationType> &
  QueryOption<OperationType> &
  BodyOption<OperationType>;

type RuntimeOptions = Omit<ApiOptions, "body" | "method"> & {
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
};

function buildPath(
  contractPath: string,
  pathParameters?: Record<string, unknown>,
  queryParameters?: Record<string, unknown>
) {
  const resolvedPath = contractPath.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = pathParameters?.[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing OpenAPI path parameter: ${name}`);
    }
    return encodeURIComponent(String(value));
  });

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(queryParameters || {})) {
    if (value !== undefined && value !== null) {
      search.set(name, String(value));
    }
  }

  const query = search.toString();
  return query ? `${resolvedPath}?${query}` : resolvedPath;
}

async function request<
  Method extends HttpMethod,
  Path extends PathsForMethod<Method>
>(
  method: Method,
  contractPath: Path,
  options: OpenApiRequestOptions<Operation<Method, Path>> = {} as OpenApiRequestOptions<
    Operation<Method, Path>
  >
): Promise<OpenApiResult<Method, Path>> {
  const { path, query, body, ...apiOptions } = options as RuntimeOptions;
  const requestPath = buildPath(contractPath, path, query);

  return apiRequest<OpenApiResult<Method, Path>>(requestPath, {
    ...apiOptions,
    method: method.toUpperCase(),
    body: body as RequestInit["body"]
  });
}

export const openApiClient = {
  get: <Path extends PathsForMethod<"get">>(
    path: Path,
    options?: OpenApiRequestOptions<Operation<"get", Path>>
  ) => request("get", path, options),
  post: <Path extends PathsForMethod<"post">>(
    path: Path,
    options?: OpenApiRequestOptions<Operation<"post", Path>>
  ) => request("post", path, options),
  put: <Path extends PathsForMethod<"put">>(
    path: Path,
    options?: OpenApiRequestOptions<Operation<"put", Path>>
  ) => request("put", path, options),
  patch: <Path extends PathsForMethod<"patch">>(
    path: Path,
    options?: OpenApiRequestOptions<Operation<"patch", Path>>
  ) => request("patch", path, options),
  delete: <Path extends PathsForMethod<"delete">>(
    path: Path,
    options?: OpenApiRequestOptions<Operation<"delete", Path>>
  ) => request("delete", path, options)
};
