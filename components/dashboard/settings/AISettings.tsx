"use client";

import React from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Database,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import {
  checkRagHealth,
  createRagCollection,
  deleteRagCollection,
  fetchRagCollectionsWithDetails,
  getCollectionDescription,
  getDefaultRagRuntimeConfig,
  ingestRagCsv,
  queryRagCollection,
  readRagRuntimeConfig,
  saveRagRuntimeConfig,
  testRagDatabase,
  updateRagCollection,
  type RagCollectionDetail,
  type RagRuntimeConfig
} from "@/lib/ragApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

const AI_SETTINGS_SECTIONS_STORAGE_KEY = "weavecarbon_ai_settings_open_sections_v1";
type OpenSectionsState = {
  runtime: boolean;
  collections: boolean;
  ingest: boolean;
};
const DEFAULT_OPEN_SECTIONS: OpenSectionsState = {
  runtime: true,
  collections: true,
  ingest: true
};

const parseColumnsInput = (value: string) =>
  value
    .split(",")
    .map((column) => column.trim())
    .filter((column, index, all) => column.length > 0 && all.indexOf(column) === index);

const toErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim().length > 0 ?
    error.message :
    "Unexpected error while calling RAG API.";

const readOpenSectionsCache = (): OpenSectionsState => {
  if (typeof window === "undefined") return DEFAULT_OPEN_SECTIONS;

  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_SECTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_OPEN_SECTIONS;
    const parsed = JSON.parse(raw) as Partial<OpenSectionsState>;
    return {
      runtime:
        typeof parsed.runtime === "boolean" ? parsed.runtime : DEFAULT_OPEN_SECTIONS.runtime,
      collections:
        typeof parsed.collections === "boolean" ?
          parsed.collections :
          DEFAULT_OPEN_SECTIONS.collections,
      ingest: typeof parsed.ingest === "boolean" ? parsed.ingest : DEFAULT_OPEN_SECTIONS.ingest
    };
  } catch {
    return DEFAULT_OPEN_SECTIONS;
  }
};

const normalizeConfig = (config: RagRuntimeConfig, columnsInput: string): RagRuntimeConfig => {
  const columns = parseColumnsInput(columnsInput);
  return {
    ...config,
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ""),
    collectionName: config.collectionName.trim(),
    columnsToAnswer: columns.length > 0 ? columns : config.columnsToAnswer,
    numberDocsRetrieval: Math.max(1, Math.min(50, Math.trunc(config.numberDocsRetrieval || 3))),
    timeoutMs: Math.max(1000, Math.min(120000, Math.trunc(config.timeoutMs || 30000)))
  };
};

const AISettings: React.FC = () => {
  const { canAccessAISettings } = usePermissions();
  const [config, setConfig] = React.useState<RagRuntimeConfig>(getDefaultRagRuntimeConfig);
  const [columnsInput, setColumnsInput] = React.useState(
    getDefaultRagRuntimeConfig().columnsToAnswer.join(", ")
  );
  const [collections, setCollections] = React.useState<RagCollectionDetail[]>([]);
  const [loadingCollections, setLoadingCollections] = React.useState(false);
  const [checkingConnection, setCheckingConnection] = React.useState(false);
  const [healthStatus, setHealthStatus] = React.useState<string>("unknown");
  const [dbStatus, setDbStatus] = React.useState<string>("unknown");
  const [dbMessage, setDbMessage] = React.useState<string>("");

  const [createName, setCreateName] = React.useState("");
  const [createDescription, setCreateDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [deletingCollectionName, setDeletingCollectionName] = React.useState<string | null>(null);
  const [pendingDeleteCollectionName, setPendingDeleteCollectionName] = React.useState<string | null>(null);

  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");

  const [indexColumn, setIndexColumn] = React.useState("chunk");
  const [ingestCollectionName, setIngestCollectionName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);

  const [queryDraft, setQueryDraft] = React.useState("");
  const [queryAnswer, setQueryAnswer] = React.useState("");
  const [querying, setQuerying] = React.useState(false);
  const [openSections, setOpenSections] = React.useState<OpenSectionsState>(DEFAULT_OPEN_SECTIONS);
  const [sectionsHydrated, setSectionsHydrated] = React.useState(false);

  const activeCollection = React.useMemo(
    () => collections.find((collection) => collection.name === config.collectionName) || null,
    [collections, config.collectionName]
  );

  const refreshCollections = React.useCallback(async (baseUrl: string) => {
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!normalizedBaseUrl) {
      setCollections([]);
      return;
    }

    setLoadingCollections(true);
    try {
      const details = await fetchRagCollectionsWithDetails(normalizedBaseUrl);
      setCollections(details);
      setConfig((previous) =>
        details.some((collection) => collection.name === previous.collectionName) ?
          previous :
          {
            ...previous,
            collectionName: ""
          }
      );
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setLoadingCollections(false);
    }
  }, []);

  React.useEffect(() => {
    const storedConfig = readRagRuntimeConfig();
    setConfig(storedConfig);
    setColumnsInput(storedConfig.columnsToAnswer.join(", "));
    setIngestCollectionName(storedConfig.collectionName);
    void refreshCollections(storedConfig.baseUrl);
  }, [refreshCollections]);

  React.useEffect(() => {
    if (activeCollection) {
      setEditName(activeCollection.name);
      setEditDescription(getCollectionDescription(activeCollection));
    } else {
      setEditName("");
      setEditDescription("");
    }
  }, [activeCollection]);

  React.useEffect(() => {
    if (!ingestCollectionName && config.collectionName) {
      setIngestCollectionName(config.collectionName);
    }
  }, [config.collectionName, ingestCollectionName]);

  React.useEffect(() => {
    setOpenSections(readOpenSectionsCache());
    setSectionsHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!sectionsHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(AI_SETTINGS_SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
  }, [openSections, sectionsHydrated]);

  if (!canAccessAISettings) {
    return null;
  }

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((previous) => ({
      ...previous,
      [section]: !previous[section]
    }));
  };

  const persistConfig = (nextConfig: RagRuntimeConfig, nextColumnsInput?: string) => {
    const normalizedColumnsInput = nextColumnsInput ?? columnsInput;
    const normalizedConfig = normalizeConfig(nextConfig, normalizedColumnsInput);
    saveRagRuntimeConfig(normalizedConfig);
    setConfig(normalizedConfig);
    setColumnsInput(normalizedConfig.columnsToAnswer.join(", "));
  };

  const handleSaveRuntimeConfig = () => {
    const normalizedConfig = normalizeConfig(config, columnsInput);
    if (!normalizedConfig.baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }
    if (!normalizedConfig.collectionName) {
      toast.error("Please choose an active collection for chat.");
      return;
    }
    if (normalizedConfig.columnsToAnswer.length === 0) {
      toast.error("columns_to_answer cannot be empty.");
      return;
    }

    persistConfig(normalizedConfig);
    toast.success("AI runtime config saved.");
  };

  const handleCheckConnection = async () => {
    const baseUrl = config.baseUrl.trim();
    if (!baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }

    setCheckingConnection(true);
    try {
      const [health, db] = await Promise.all([checkRagHealth(baseUrl), testRagDatabase(baseUrl)]);
      setHealthStatus(health.status || "unknown");
      setDbStatus(db.status || "unknown");
      setDbMessage(db.message || "");
      toast.success("RAG API connection is healthy.");
    } catch (error) {
      setHealthStatus("error");
      setDbStatus("error");
      setDbMessage(toErrorMessage(error));
      toast.error(toErrorMessage(error));
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleCreateCollection = async () => {
    const baseUrl = config.baseUrl.trim();
    const name = createName.trim();
    if (!baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }
    if (!name) {
      toast.error("Collection name is required.");
      return;
    }

    setCreating(true);
    try {
      const created = await createRagCollection(baseUrl, {
        name,
        description: createDescription.trim() || undefined
      });
      setCreateName("");
      setCreateDescription("");
      await refreshCollections(baseUrl);
      const nextConfig = {
        ...config,
        collectionName: config.collectionName || created.name
      };
      setConfig(nextConfig);
      if (!config.collectionName) {
        persistConfig(nextConfig);
      }
      toast.success(`Collection "${created.name}" created.`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCollection = async () => {
    if (!activeCollection) {
      toast.error("Please select a collection first.");
      return;
    }

    const baseUrl = config.baseUrl.trim();
    if (!baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }

    const nextName = editName.trim();
    const nextDescription = editDescription.trim();
    const currentDescription = getCollectionDescription(activeCollection);

    const hasNameChange = nextName.length > 0 && nextName !== activeCollection.name;
    const hasDescriptionChange = nextDescription !== currentDescription;

    if (!hasNameChange && !hasDescriptionChange) {
      toast.message("No collection changes to save.");
      return;
    }

    setUpdating(true);
    try {
      const updated = await updateRagCollection(baseUrl, activeCollection.name, {
        new_name: hasNameChange ? nextName : undefined,
        metadata: hasDescriptionChange ? { description: nextDescription } : undefined
      });

      const nextConfig = {
        ...config,
        collectionName:
          config.collectionName === activeCollection.name ? updated.name : config.collectionName
      };
      setConfig(nextConfig);
      await refreshCollections(baseUrl);
      if (config.collectionName === activeCollection.name) {
        persistConfig(nextConfig);
      }
      toast.success(`Collection "${updated.name}" updated.`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    const baseUrl = config.baseUrl.trim();
    if (!baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }
    setPendingDeleteCollectionName(collectionName);
  };

  const handleConfirmDeleteCollection = async (collectionName: string) => {
    const baseUrl = config.baseUrl.trim();
    if (!baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }

    setDeletingCollectionName(collectionName);
    try {
      await deleteRagCollection(baseUrl, collectionName);
      const wasActive = config.collectionName === collectionName;
      const nextConfig = wasActive ?
        {
          ...config,
          collectionName: ""
        } :
        config;
      setConfig(nextConfig);
      if (wasActive) {
        persistConfig(nextConfig);
      }
      await refreshCollections(baseUrl);
      setPendingDeleteCollectionName(null);
      toast.success(`Collection "${collectionName}" deleted.`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setDeletingCollectionName(null);
    }
  };

  const handleUploadCsv = async () => {
    const baseUrl = config.baseUrl.trim();
    if (!baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }
    if (!uploadFile) {
      toast.error("Please choose a CSV file.");
      return;
    }
    if (!indexColumn.trim()) {
      toast.error("index_column is required.");
      return;
    }

    setUploading(true);
    try {
      const result = await ingestRagCsv(baseUrl, {
        file: uploadFile,
        indexColumn: indexColumn.trim(),
        collectionName: ingestCollectionName.trim() || undefined
      });
      const nextConfig = {
        ...config,
        collectionName: config.collectionName || result.collection_name
      };
      setConfig(nextConfig);
      if (!config.collectionName && result.collection_name) {
        persistConfig(nextConfig);
      }
      setIngestCollectionName(result.collection_name);
      await refreshCollections(baseUrl);
      toast.success(
        `Ingest success. Collection: ${result.collection_name} | Rows: ${result.rows} | Chunks: ${result.chunks}`
      );
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleTestQuery = async () => {
    const normalizedConfig = normalizeConfig(config, columnsInput);
    if (!normalizedConfig.baseUrl) {
      toast.error("RAG API base URL is required.");
      return;
    }
    if (!normalizedConfig.collectionName) {
      toast.error("Please choose an active collection.");
      return;
    }
    if (!queryDraft.trim()) {
      toast.error("Enter a question to test.");
      return;
    }
    if (normalizedConfig.columnsToAnswer.length === 0) {
      toast.error("columns_to_answer cannot be empty.");
      return;
    }

    setQuerying(true);
    setQueryAnswer("");
    try {
      const response = await queryRagCollection(
        normalizedConfig.baseUrl,
        normalizedConfig.collectionName,
        {
          query: queryDraft.trim(),
          columns_to_answer: normalizedConfig.columnsToAnswer,
          number_docs_retrieval: normalizedConfig.numberDocsRetrieval
        },
        normalizedConfig.timeoutMs
      );
      const answer = response.answer || response.retrieved_data || "No answer returned by backend.";
      setQueryAnswer(answer);
    } catch (error) {
      const message = toErrorMessage(error);
      setQueryAnswer(message);
      toast.error(message);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-700" />
              AI Runtime
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("runtime")}
              aria-label={openSections.runtime ? "Collapse AI Runtime" : "Expand AI Runtime"}
            >
              {openSections.runtime ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
          <CardDescription>
            Configure RAG backend and the active collection used by Weavey chat.
          </CardDescription>
        </CardHeader>
        {openSections.runtime ?
          <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rag-base-url">RAG API Base URL</Label>
              <Input
                id="rag-base-url"
                value={config.baseUrl}
                onChange={(event) =>
                  setConfig((previous) => ({
                    ...previous,
                    baseUrl: event.target.value
                  }))
                }
                placeholder="http://127.0.0.1:8000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rag-collection">Active collection</Label>
              <Input
                id="rag-collection"
                value={config.collectionName}
                onChange={(event) =>
                  setConfig((previous) => ({
                    ...previous,
                    collectionName: event.target.value
                  }))
                }
                placeholder="rag_collection_demo"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rag-columns">columns_to_answer (comma-separated)</Label>
              <Input
                id="rag-columns"
                value={columnsInput}
                onChange={(event) => setColumnsInput(event.target.value)}
                placeholder="product_name, total_co2e, chunk"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rag-top-k">number_docs_retrieval</Label>
                <Input
                  id="rag-top-k"
                  type="number"
                  min={1}
                  max={50}
                  value={config.numberDocsRetrieval}
                  onChange={(event) =>
                    setConfig((previous) => ({
                      ...previous,
                      numberDocsRetrieval: Math.max(
                        1,
                        Math.min(50, Math.trunc(Number(event.target.value) || 1))
                      )
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rag-timeout">timeout (ms)</Label>
                <Input
                  id="rag-timeout"
                  type="number"
                  min={1000}
                  max={120000}
                  value={config.timeoutMs}
                  onChange={(event) =>
                    setConfig((previous) => ({
                      ...previous,
                      timeoutMs: Math.max(
                        1000,
                        Math.min(120000, Math.trunc(Number(event.target.value) || 1000))
                      )
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveRuntimeConfig}>
              <Save className="w-4 h-4 mr-2" />
              Save runtime config
            </Button>
            <Button
              variant="outline"
              onClick={() => refreshCollections(config.baseUrl)}
              disabled={loadingCollections}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingCollections ? "animate-spin" : ""}`} />
              Refresh collections
            </Button>
            <Button variant="outline" onClick={handleCheckConnection} disabled={checkingConnection}>
              <Database className={`w-4 h-4 mr-2 ${checkingConnection ? "animate-spin" : ""}`} />
              Check connection
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">Health: {healthStatus}</Badge>
            <Badge variant="secondary">DB: {dbStatus}</Badge>
            {dbMessage ?
              <span className="text-muted-foreground">{dbMessage}</span> :
              null}
          </div>
          </CardContent> :
          null}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Collection management</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("collections")}
              aria-label={
                openSections.collections ?
                "Collapse Collection management" :
                "Expand Collection management"
              }
            >
              {openSections.collections ?
                <ChevronDown className="w-4 h-4" /> :
                <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
          <CardDescription>Create, edit, delete, and pick active collections.</CardDescription>
        </CardHeader>
        {openSections.collections ?
          <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_auto]">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Collection name"
            />
            <Input
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="Description (optional)"
            />
            <Button onClick={handleCreateCollection} disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </div>

          <div className="rounded-md border border-slate-200">
            {collections.length === 0 ?
              <div className="px-3 py-4 text-sm text-muted-foreground">No collections found.</div> :
              <div className="divide-y divide-slate-200">
                {collections.map((collection) => {
                  const isActive = collection.name === config.collectionName;
                  return (
                    <div
                      key={collection.name}
                      className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{collection.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getCollectionDescription(collection) || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{collection.count} docs</Badge>
                        <Button
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          onClick={() => {
                            const nextConfig = {
                              ...config,
                              collectionName: collection.name
                            };
                            persistConfig(nextConfig);
                            toast.success(`Active collection is now "${collection.name}".`);
                          }}
                        >
                          {isActive ? "Active" : "Set active"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void handleDeleteCollection(collection.name)}
                          disabled={deletingCollectionName === collection.name}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>}
          </div>

          <div className="space-y-3 rounded-md border border-slate-200 p-3">
            <div>
              <p className="font-medium">Edit selected collection</p>
              <p className="text-xs text-muted-foreground">
                Works for the current active collection only.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="New name"
                disabled={!activeCollection}
              />
              <Input
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="Description"
                disabled={!activeCollection}
              />
            </div>
            <Button onClick={handleUpdateCollection} disabled={!activeCollection || updating}>
              Save collection changes
            </Button>
          </div>
          </CardContent> :
          null}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Ingest + Query test</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("ingest")}
              aria-label={openSections.ingest ? "Collapse Ingest + Query test" : "Expand Ingest + Query test"}
            >
              {openSections.ingest ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
          <CardDescription>
            Upload CSV into a collection and test a query with current runtime config.
          </CardDescription>
        </CardHeader>
        {openSections.ingest ?
          <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr_auto]">
            <Input
              value={ingestCollectionName}
              onChange={(event) => setIngestCollectionName(event.target.value)}
              placeholder="collection_name (optional)"
            />
            <Input
              value={indexColumn}
              onChange={(event) => setIndexColumn(event.target.value)}
              placeholder="index_column"
            />
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
            <Button onClick={handleUploadCsv} disabled={uploading}>
              <Upload className="w-4 h-4 mr-2" />
              Ingest CSV
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rag-query-test">Query test</Label>
            <Textarea
              id="rag-query-test"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Ask a question..."
              className="min-h-20"
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleTestQuery} disabled={querying}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Run query
              </Button>
            </div>
            <Textarea value={queryAnswer} readOnly placeholder="Answer will appear here." />
          </div>
          </CardContent> :
          null}
      </Card>

      <AlertDialog
        open={Boolean(pendingDeleteCollectionName)}
        onOpenChange={(open) => {
          if (!open && !deletingCollectionName) {
            setPendingDeleteCollectionName(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md border-slate-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete collection "${pendingDeleteCollectionName || ""}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingCollectionName)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!pendingDeleteCollectionName || Boolean(deletingCollectionName)}
              onClick={async (event) => {
                event.preventDefault();
                if (!pendingDeleteCollectionName) {
                  return;
                }
                await handleConfirmDeleteCollection(pendingDeleteCollectionName);
              }}
            >
              {deletingCollectionName === pendingDeleteCollectionName ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AISettings;
