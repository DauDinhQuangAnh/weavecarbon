"use client";

import React from "react";
import {
  Bot,
  Database,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getGlobalAiRuntimeConfig, saveGlobalAiRuntimeConfig } from "@/lib/aiConfigApi";import {
  checkRagHealth,
  createRagCollection,
  deleteRagCollection,
  fetchRagCollectionsWithDetails,
  getCollectionDescription,
  getDefaultRagRuntimeConfig,
  ingestRagCsv,
  queryRagCollection,
  testRagDatabase,
  updateRagCollection,
  type RagCollectionDetail,
  type RagRuntimeConfig,
} from "@/lib/ragApi";

type StatusTone = "unknown" | "ok" | "error";

interface ServiceStatus {
  tone: StatusTone;
  label: string;
  detail: string;
}

interface QueryState {
  answer: string;
  retrievedData: string;
  error: string;
}

const statusClasses: Record<StatusTone, string> = {
  unknown: "border-slate-300 bg-slate-100 text-slate-700",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
  error: "border-rose-300 bg-rose-50 text-rose-700"
};

const parseColumns = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);

const formatColumns = (value: string[]) => value.join(", ");

const unknownStatus = (): ServiceStatus => ({
  tone: "unknown",
  label: "Unknown",
  detail: "Not checked yet"
});

const SectionHeader = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  </div>
);

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-semibold text-slate-800">{label}</Label>
    {children}
    {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const StatusPanel = ({
  title,
  icon: Icon,
  status,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: ServiceStatus;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{status.detail}</p>
        </div>
      </div>
      <Badge variant="outline" className={cn("capitalize", statusClasses[status.tone])}>
        {status.label}
      </Badge>
    </div>
  </div>
);

const AIConfigConsole: React.FC = () => {
  const fallbackConfig = React.useMemo(() => getDefaultRagRuntimeConfig(), []);
  const [hydrated, setHydrated] = React.useState(false);

  const [runtimeConfig, setRuntimeConfig] = React.useState<RagRuntimeConfig>(fallbackConfig);
  const [columnsInput, setColumnsInput] = React.useState(formatColumns(fallbackConfig.columnsToAnswer));
  const [collections, setCollections] = React.useState<RagCollectionDetail[]>([]);
  const [selectedCollectionName, setSelectedCollectionName] = React.useState("");
  const [newCollectionName, setNewCollectionName] = React.useState("");
  const [newCollectionDescription, setNewCollectionDescription] = React.useState("");
  const [editCollectionName, setEditCollectionName] = React.useState("");
  const [editCollectionDescription, setEditCollectionDescription] = React.useState("");
  const [ingestCollectionName, setIngestCollectionName] = React.useState("");
  const [indexColumn, setIndexColumn] = React.useState("Question");
  const [ingestFile, setIngestFile] = React.useState<File | null>(null);
  const [testQuery, setTestQuery] = React.useState("");
  const [queryState, setQueryState] = React.useState<QueryState>({
    answer: "",
    retrievedData: "",
    error: ""
  });
  const [healthStatus, setHealthStatus] = React.useState<ServiceStatus>(unknownStatus());
  const [dbStatus, setDbStatus] = React.useState<ServiceStatus>(unknownStatus());

  const [bootstrapping, setBootstrapping] = React.useState(false);
  const [savingRuntime, setSavingRuntime] = React.useState(false);
  const [refreshingWorkspace, setRefreshingWorkspace] = React.useState(false);
  const [creatingCollection, setCreatingCollection] = React.useState(false);
  const [updatingCollection, setUpdatingCollection] = React.useState(false);
  const [deletingCollection, setDeletingCollection] = React.useState("");
  const [ingesting, setIngesting] = React.useState(false);
  const [runningQuery, setRunningQuery] = React.useState(false);

  const selectedCollection = React.useMemo(
    () => collections.find((item) => item.name === selectedCollectionName) || null,
    [collections, selectedCollectionName]
  );

  const applyRuntimeConfig = React.useCallback((config: RagRuntimeConfig) => {
    setRuntimeConfig(config);
    setColumnsInput(formatColumns(config.columnsToAnswer));
    setSelectedCollectionName((current) => current || config.collectionName);
    setIngestCollectionName(config.collectionName);
  }, []);

  const syncSelectedCollectionEditor = React.useCallback((collection: RagCollectionDetail | null) => {
    if (!collection) {
      setEditCollectionName("");
      setEditCollectionDescription("");
      return;
    }

    setEditCollectionName(collection.name);
    setEditCollectionDescription(getCollectionDescription(collection));
  }, []);

  const refreshWorkspace = React.useCallback(
    async (baseUrl: string, preferredCollectionName?: string) => {
      const targetBaseUrl = baseUrl.trim();
      if (!targetBaseUrl) {
        setHealthStatus({
          tone: "error",
          label: "Missing base URL",
          detail: "Enter a RAG base URL to run diagnostics."
        });
        setDbStatus({
          tone: "error",
          label: "Missing base URL",
          detail: "Enter a RAG base URL to run diagnostics."
        });
        setCollections([]);
        setSelectedCollectionName("");
        syncSelectedCollectionEditor(null);
        return;
      }

      setRefreshingWorkspace(true);

      const [healthResult, dbResult, collectionsResult] = await Promise.allSettled([
        checkRagHealth(targetBaseUrl),
        testRagDatabase(targetBaseUrl),
        fetchRagCollectionsWithDetails(targetBaseUrl)
      ]);

      if (healthResult.status === "fulfilled") {
        const ok = healthResult.value.status.toLowerCase() === "ok";
        setHealthStatus({
          tone: ok ? "ok" : "unknown",
          label: healthResult.value.status,
          detail: `Checked ${targetBaseUrl}/health`
        });
      } else {
        setHealthStatus({
          tone: "error",
          label: "Unavailable",
          detail:
            healthResult.reason instanceof Error ? healthResult.reason.message : "Health check failed"
        });
      }

      if (dbResult.status === "fulfilled") {
        const ok = dbResult.value.status.toLowerCase() === "ok";
        setDbStatus({
          tone: ok ? "ok" : "unknown",
          label: dbResult.value.status,
          detail: dbResult.value.message || "Database status received"
        });
      } else {
        setDbStatus({
          tone: "error",
          label: "Unavailable",
          detail: dbResult.reason instanceof Error ? dbResult.reason.message : "Database test failed"
        });
      }

      if (collectionsResult.status === "fulfilled") {
        const nextCollections = collectionsResult.value;
        setCollections(nextCollections);
        setSelectedCollectionName((current) => {
          const preferred =
            preferredCollectionName && nextCollections.some((item) => item.name === preferredCollectionName)
              ? preferredCollectionName
              : current && nextCollections.some((item) => item.name === current)
                ? current
                : "";
          const fallback =
            runtimeConfig.collectionName &&
            nextCollections.some((item) => item.name === runtimeConfig.collectionName)
              ? runtimeConfig.collectionName
              : nextCollections[0]?.name || "";
          const nextSelected = preferred || fallback;
          syncSelectedCollectionEditor(
            nextCollections.find((item) => item.name === nextSelected) || null
          );
          return nextSelected;
        });
      } else {
        setCollections([]);
        setSelectedCollectionName("");
        syncSelectedCollectionEditor(null);
        toast.error(
          collectionsResult.reason instanceof Error
            ? collectionsResult.reason.message
            : "Failed to load collections."
        );
      }

      setRefreshingWorkspace(false);
    },
    [runtimeConfig.collectionName, syncSelectedCollectionEditor]
  );

  const bootstrap = React.useCallback(async () => {
    setBootstrapping(true);
    try {
      const config = await getGlobalAiRuntimeConfig();
      applyRuntimeConfig(config);
      await refreshWorkspace(config.baseUrl, config.collectionName);
    } catch (error) {
      applyRuntimeConfig(fallbackConfig);
      await refreshWorkspace(fallbackConfig.baseUrl, fallbackConfig.collectionName);
      toast.error(error instanceof Error ? error.message : "Failed to load global AI config.");
    } finally {
      setBootstrapping(false);
    }
  }, [applyRuntimeConfig, fallbackConfig, refreshWorkspace]);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [bootstrap, hydrated]);

  React.useEffect(() => {
    syncSelectedCollectionEditor(selectedCollection);
  }, [selectedCollection, syncSelectedCollectionEditor]);

  const saveRuntime = async () => {
    const columns = parseColumns(columnsInput);
    if (columns.length === 0) {
      toast.error("Enter at least one column to answer.");
      return;
    }

    setSavingRuntime(true);
    try {
      const savedConfig = await saveGlobalAiRuntimeConfig({
        ...runtimeConfig,
        columnsToAnswer: columns
      });
      applyRuntimeConfig(savedConfig);
      toast.success("Global AI runtime saved.");
      await refreshWorkspace(savedConfig.baseUrl, savedConfig.collectionName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save global AI runtime.");
    } finally {
      setSavingRuntime(false);
    }
  };

  const createCollection = async () => {
    const collectionName = newCollectionName.trim();
    if (!collectionName) {
      toast.error("Collection name is required.");
      return;
    }

    setCreatingCollection(true);
    try {
      const created = await createRagCollection(runtimeConfig.baseUrl, {
        name: collectionName,
        description: newCollectionDescription.trim() || undefined
      });
      setNewCollectionName("");
      setNewCollectionDescription("");
      setSelectedCollectionName(created.name);
      setIngestCollectionName(created.name);
      toast.success(`Collection "${created.name}" created.`);
      await refreshWorkspace(runtimeConfig.baseUrl, created.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create collection.");
    } finally {
      setCreatingCollection(false);
    }
  };

  const updateCollection = async () => {
    if (!selectedCollection) {
      toast.error("Select a collection first.");
      return;
    }

    const nextName = editCollectionName.trim();
    if (!nextName) {
      toast.error("Collection name is required.");
      return;
    }

    setUpdatingCollection(true);
    try {
      const metadata = { ...(selectedCollection.metadata || {}) };
      if (editCollectionDescription.trim()) {
        metadata.description = editCollectionDescription.trim();
      } else {
        delete metadata.description;
      }

      const updated = await updateRagCollection(runtimeConfig.baseUrl, selectedCollection.name, {
        new_name: nextName !== selectedCollection.name ? nextName : undefined,
        metadata
      });

      setSelectedCollectionName(updated.name);
      setIngestCollectionName((current) =>
        current === selectedCollection.name ? updated.name : current
      );
      setRuntimeConfig((current) => ({
        ...current,
        collectionName:
          current.collectionName === selectedCollection.name ? updated.name : current.collectionName
      }));
      toast.success(`Collection "${updated.name}" updated.`);
      await refreshWorkspace(runtimeConfig.baseUrl, updated.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update collection.");
    } finally {
      setUpdatingCollection(false);
    }
  };

  const removeCollection = async (collectionName: string) => {
    const confirmed = window.confirm(`Delete collection "${collectionName}"?`);
    if (!confirmed) return;

    setDeletingCollection(collectionName);
    try {
      await deleteRagCollection(runtimeConfig.baseUrl, collectionName);
      setRuntimeConfig((current) => ({
        ...current,
        collectionName: current.collectionName === collectionName ? "" : current.collectionName
      }));
      setIngestCollectionName((current) => (current === collectionName ? "" : current));
      toast.success(`Collection "${collectionName}" deleted.`);
      await refreshWorkspace(runtimeConfig.baseUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete collection.");
    } finally {
      setDeletingCollection("");
    }
  };

  const selectCollectionForRuntime = (collectionName: string) => {
    setSelectedCollectionName(collectionName);
    setIngestCollectionName(collectionName);
    setRuntimeConfig((current) => ({
      ...current,
      collectionName
    }));
    toast.success(`Runtime form now targets "${collectionName}". Save runtime to apply.`);
  };

  const runIngest = async () => {
    if (!ingestFile) {
      toast.error("Choose a CSV file before ingesting.");
      return;
    }

    const collectionName = ingestCollectionName.trim() || runtimeConfig.collectionName.trim();
    if (!collectionName) {
      toast.error("Pick a target collection before ingesting.");
      return;
    }

    const indexName = indexColumn.trim();
    if (!indexName) {
      toast.error("Index column is required.");
      return;
    }

    setIngesting(true);
    try {
      const result = await ingestRagCsv(runtimeConfig.baseUrl, {
        file: ingestFile,
        indexColumn: indexName,
        collectionName
      });
      toast.success(
        `Ingested ${result.rows} rows and ${result.chunks} chunks into "${result.collection_name}".`
      );
      await refreshWorkspace(runtimeConfig.baseUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to ingest CSV.");
    } finally {
      setIngesting(false);
    }
  };

  const runQuery = async () => {
    const prompt = testQuery.trim();
    if (!prompt) {
      toast.error("Enter a query before testing.");
      return;
    }

    const columns = parseColumns(columnsInput);
    if (columns.length === 0) {
      toast.error("Enter at least one column to answer.");
      return;
    }

    if (!runtimeConfig.collectionName.trim()) {
      toast.error("Runtime collection is required.");
      return;
    }

    setRunningQuery(true);
    setQueryState({
      answer: "",
      retrievedData: "",
      error: ""
    });

    try {
      const result = await queryRagCollection(
        runtimeConfig.baseUrl,
        runtimeConfig.collectionName,
        {
          query: prompt,
          columns_to_answer: columns,
          number_docs_retrieval: runtimeConfig.numberDocsRetrieval
        },
        runtimeConfig.timeoutMs
      );

      setQueryState({
        answer: result.answer,
        retrievedData: result.retrieved_data,
        error: ""
      });
      toast.success("Test query completed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run test query.";
      setQueryState({
        answer: "",
        retrievedData: "",
        error: message
      });
      toast.error(message);
    } finally {
      setRunningQuery(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-950/95 px-4 py-10 text-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading AI config console...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#17322c_0%,#365f4d_42%,#c17d42_100%)] text-white shadow-xl">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Bot className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
                  Hidden AI Config
                </Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Global AI runtime console</h1>
                <p className="mt-2 max-w-3xl text-sm text-white/80">
                  This page controls the live dashboard chatbot runtime and keeps the older AI admin tools in one standalone place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-white/15 bg-white/10 text-white">
                Live collection: {runtimeConfig.collectionName || "Not set"}
              </Badge>
              <Badge variant="outline" className="border-white/15 bg-white/10 text-white">
                Columns: {columnsInput || "Not set"}
              </Badge>
              <Button
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => void refreshWorkspace(runtimeConfig.baseUrl)}
                disabled={refreshingWorkspace || bootstrapping}
              >
                {refreshingWorkspace ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh RAG
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-6">
            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  icon={Shield}
                  title="Runtime config"
                  description="Saving this form updates the global production runtime used by dashboard chat."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatusPanel title="RAG health" icon={Bot} status={healthStatus} />
                  <StatusPanel title="Database test" icon={Database} status={dbStatus} />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field label="RAG base URL" hint="Saved globally and used by production chat.">
                    <Input
                      value={runtimeConfig.baseUrl}
                      onChange={(event) =>
                        setRuntimeConfig((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                      placeholder="https://weavecarbon.com/rag"
                    />
                  </Field>
                  <Field label="Collection name" hint="Production chat uses this after you save runtime.">
                    <Input
                      value={runtimeConfig.collectionName}
                      onChange={(event) =>
                        setRuntimeConfig((current) => ({
                          ...current,
                          collectionName: event.target.value
                        }))
                      }
                      placeholder="weaveCarbon_1"
                    />
                  </Field>
                  <Field label="columns_to_answer" hint="Comma-separated list of response columns.">
                    <Input
                      value={columnsInput}
                      onChange={(event) => setColumnsInput(event.target.value)}
                      placeholder="Question"
                    />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="number_docs_retrieval">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={runtimeConfig.numberDocsRetrieval}
                        onChange={(event) =>
                          setRuntimeConfig((current) => ({
                            ...current,
                            numberDocsRetrieval: Number(event.target.value || 0)
                          }))
                        }
                      />
                    </Field>
                    <Field label="timeout_ms">
                      <Input
                        type="number"
                        min={1000}
                        max={120000}
                        value={runtimeConfig.timeoutMs}
                        onChange={(event) =>
                          setRuntimeConfig((current) => ({
                            ...current,
                            timeoutMs: Number(event.target.value || 0)
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void saveRuntime()} disabled={savingRuntime || bootstrapping}>
                    {savingRuntime ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save runtime
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void refreshWorkspace(runtimeConfig.baseUrl)}
                    disabled={refreshingWorkspace || bootstrapping}
                  >
                    {refreshingWorkspace ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh diagnostics
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  icon={Database}
                  title="Collection management"
                  description="Create, inspect, update, delete, and route collections into the runtime form."
                />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 lg:grid-cols-[1fr_1.2fr_auto]">
                  <Field label="New collection">
                    <Input
                      value={newCollectionName}
                      onChange={(event) => setNewCollectionName(event.target.value)}
                      placeholder="Collection name"
                    />
                  </Field>
                  <Field label="Description">
                    <Input
                      value={newCollectionDescription}
                      onChange={(event) => setNewCollectionDescription(event.target.value)}
                      placeholder="Optional description"
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      className="w-full lg:w-auto"
                      onClick={() => void createCollection()}
                      disabled={creatingCollection}
                    >
                      {creatingCollection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                      Create
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Collections</p>
                        <p className="text-xs text-slate-500">{collections.length} collections loaded</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void refreshWorkspace(runtimeConfig.baseUrl)}
                        disabled={refreshingWorkspace}
                      >
                        {refreshingWorkspace ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh
                      </Button>
                    </div>
                    <ScrollArea className="h-[360px]">
                      <div className="space-y-3 p-4">
                        {collections.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                            No collections loaded yet.
                          </div>
                        ) : (
                          collections.map((collection) => {
                            const isSelected = collection.name === selectedCollectionName;
                            const isRuntimeCollection =
                              collection.name === runtimeConfig.collectionName;

                            return (
                              <div
                                key={collection.name}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedCollectionName(collection.name)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedCollectionName(collection.name);
                                  }
                                }}
                                className={cn(
                                  "w-full rounded-2xl border px-4 py-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/40",
                                  isSelected
                                    ? "border-primary/40 bg-primary/8 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                )}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-slate-900">{collection.name}</span>
                                      {isRuntimeCollection ? (
                                        <Badge
                                          variant="outline"
                                          className="border-emerald-300 bg-emerald-50 text-emerald-700"
                                        >
                                          Runtime
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      {getCollectionDescription(collection) || "No description yet"}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                                    {collection.count} docs
                                  </Badge>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isRuntimeCollection ? "secondary" : "outline"}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      selectCollectionForRuntime(collection.name);
                                    }}
                                  >
                                    Use in runtime
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setIngestCollectionName(collection.name);
                                      toast.success(`Ingest target set to "${collection.name}".`);
                                    }}
                                  >
                                    Use in ingest
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void removeCollection(collection.name);
                                    }}
                                    disabled={deletingCollection === collection.name}
                                  >
                                    {deletingCollection === collection.name ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Edit selected collection</p>
                      <p className="text-xs text-slate-500">Pick a collection on the left to edit its metadata.</p>
                    </div>
                    <Separator />
                    <Field label="Collection name">
                      <Input
                        value={editCollectionName}
                        onChange={(event) => setEditCollectionName(event.target.value)}
                        placeholder="Select a collection first"
                        disabled={!selectedCollection}
                      />
                    </Field>
                    <Field label="Description">
                      <Textarea
                        value={editCollectionDescription}
                        onChange={(event) => setEditCollectionDescription(event.target.value)}
                        placeholder="Optional description"
                        disabled={!selectedCollection}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => void updateCollection()}
                        disabled={!selectedCollection || updatingCollection}
                      >
                        {updatingCollection ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          selectedCollection ? selectCollectionForRuntime(selectedCollection.name) : null
                        }
                        disabled={!selectedCollection}
                      >
                        Use in runtime
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  icon={Upload}
                  title="CSV ingest"
                  description="Push new dataset rows into the selected RAG collection."
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Target collection">
                  <Input
                    value={ingestCollectionName}
                    onChange={(event) => setIngestCollectionName(event.target.value)}
                    placeholder="weaveCarbon_1"
                  />
                </Field>
                <Field label="Index column" hint="Used by the RAG ingest endpoint for indexing.">
                  <Input
                    value={indexColumn}
                    onChange={(event) => setIndexColumn(event.target.value)}
                    placeholder="Question"
                  />
                </Field>
                <Field label="CSV file">
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setIngestFile(event.target.files?.[0] || null)}
                  />
                </Field>
                <Button onClick={() => void runIngest()} disabled={ingesting}>
                  {ingesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Ingest file
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  icon={Search}
                  title="Test query"
                  description="Run a direct RAG query against the current runtime form before users do."
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Prompt">
                  <Textarea
                    value={testQuery}
                    onChange={(event) => setTestQuery(event.target.value)}
                    placeholder="Ask something against the configured collection..."
                    className="min-h-[110px]"
                  />
                </Field>
                <Button onClick={() => void runQuery()} disabled={runningQuery}>
                  {runningQuery ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Run test query
                </Button>

                {queryState.error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {queryState.error}
                  </div>
                ) : null}

                <Field label="Answer">
                  <Textarea
                    value={queryState.answer}
                    readOnly
                    placeholder="The generated answer will appear here."
                    className="min-h-[140px] bg-slate-50"
                  />
                </Field>
                <Field label="Retrieved data">
                  <Textarea
                    value={queryState.retrievedData}
                    readOnly
                    placeholder="Retrieved context will appear here."
                    className="min-h-[160px] bg-slate-50"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  icon={Wrench}
                  title="Console notes"
                  description="Quick reminders about what this hidden page controls."
                />
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  This console is gated server-side by `AI_CONFIG_CONSOLE_ENABLED`.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  Saving runtime here changes the configuration used by dashboard chatbot messages globally.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  Collections, ingest, and query tools use the current runtime base URL directly from the browser.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfigConsole;
