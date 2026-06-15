import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { getMyAccess } from "@/lib/claims.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, X, Plus, Trash2, Building2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import {
  listSuppliers,
  createSupplier,
  decideSupplier,
  deleteSupplier,
  listPurchases,
  createPurchase,
  decidePurchase,
  deletePurchase,
} from "@/lib/approvals.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-green-600 hover:bg-green-600">Schváleno</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive">Zamítnuto</Badge>;
  return <Badge variant="secondary">Čeká</Badge>;
}

function ApprovalsPage() {
  const fetchAccess = useServerFn(getMyAccess);
  const { data: access } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess({}),
  });
  const isAdmin = !!access?.isAdmin;
  return (
    <AdminShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-semibold">Schvalování</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Schvalujte žádosti zaměstnanců o nákupy a dodavatele."
              : "Vaše žádosti o nákupy a dodavatele. Schvaluje super admin."}
          </p>
        </header>
        <Tabs defaultValue="purchases">
          <TabsList>
            <TabsTrigger value="purchases">
              <ShoppingCart className="mr-2 h-4 w-4" /> Nákupy
            </TabsTrigger>
            <TabsTrigger value="suppliers">
              <Building2 className="mr-2 h-4 w-4" /> Dodavatelé
            </TabsTrigger>
          </TabsList>
          <TabsContent value="purchases" className="mt-4">
            <PurchasesTab isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            <SuppliersTab isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}

function SuppliersTab({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const fetchList = useServerFn(listSuppliers);
  const create = useServerFn(createSupplier);
  const decide = useServerFn(decideSupplier);
  const del = useServerFn(deleteSupplier);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetchList(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ico: "",
    dic: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: form });
      toast.success("Dodavatel přidán");
      setOpen(false);
      setForm({ name: "", ico: "", dic: "", contact_person: "", email: "", phone: "", address: "", notes: "" });
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Chyba");
    }
  }

  async function setStatus(id: string, status: "approved" | "rejected") {
    try {
      await decide({ data: { id, status } });
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Chyba");
    }
  }

  async function remove(id: string) {
    if (!confirm("Smazat dodavatele?")) return;
    await del({ data: { id } });
    refetch();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Dodavatelé</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nový dodavatel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nový dodavatel</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Název *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>IČO</Label><Input value={form.ico} onChange={(e) => setForm({ ...form, ico: e.target.value })} /></div>
                <div><Label>DIČ</Label><Input value={form.dic} onChange={(e) => setForm({ ...form, dic: e.target.value })} /></div>
              </div>
              <div><Label>Kontaktní osoba</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Adresa</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Poznámka</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <DialogFooter><Button type="submit">Uložit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">Žádní dodavatelé.</p>
        ) : (
          <div className="space-y-2">
            {data.map((s: any) => (
              <div key={s.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{s.name}</div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[s.ico && `IČO ${s.ico}`, s.contact_person, s.email, s.phone].filter(Boolean).join(" · ")}
                  </div>
                  {s.requester && (
                    <div className="truncate text-xs text-muted-foreground">
                      Žádá: {s.requester.full_name || s.requester.email}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {isAdmin && s.status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "approved")}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && s.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "rejected")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PurchasesTab({ isAdmin }: { isAdmin: boolean }) {
  const fetchList = useServerFn(listPurchases);
  const fetchSuppliers = useServerFn(listSuppliers);
  const create = useServerFn(createPurchase);
  const decide = useServerFn(decidePurchase);
  const del = useServerFn(deletePurchase);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => fetchList(),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetchSuppliers(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    supplier_id: "",
    amount: "",
    amount_net: "",
    vat_rate: "21",
    currency: "CZK",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({
        data: {
          title: form.title,
          description: form.description || null,
          supplier_id: form.supplier_id || null,
          amount: form.amount ? Number(form.amount) : null,
          amount_net: form.amount_net ? Number(form.amount_net) : null,
          vat_rate: form.vat_rate ? Number(form.vat_rate) : 21,
          currency: form.currency || "CZK",
        },
      });
      toast.success("Žádost o nákup vytvořena");
      setOpen(false);
      setForm({ title: "", description: "", supplier_id: "", amount: "", amount_net: "", vat_rate: "21", currency: "CZK" });
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Chyba");
    }
  }

  async function setStatus(id: string, status: "approved" | "rejected") {
    try {
      await decide({ data: { id, status } });
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Chyba");
    }
  }

  async function remove(id: string) {
    if (!confirm("Smazat nákup?")) return;
    await del({ data: { id } });
    refetch();
  }

  const approvedSuppliers = (suppliers ?? []).filter((s: any) => s.status === "approved");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Nákupy</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nový nákup</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nový nákup ke schválení</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Název *</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Popis</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label>Dodavatel</Label>
                <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Vyberte dodavatele" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— bez dodavatele —</SelectItem>
                    {approvedSuppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!approvedSuppliers.length && (
                  <p className="mt-1 text-xs text-muted-foreground">Tip: nejprve schvalte dodavatele v záložce Dodavatelé.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><Label>Částka</Label><Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Měna</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              </div>
              <DialogFooter><Button type="submit">Uložit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">Žádné nákupy.</p>
        ) : (
          <div className="space-y-2">
            {data.map((p: any) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{p.title}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[
                      p.supplier?.name,
                      p.amount != null && `${Number(p.amount).toLocaleString("cs-CZ")} ${p.currency}`,
                      new Date(p.created_at).toLocaleDateString("cs-CZ"),
                    ].filter(Boolean).join(" · ")}
                  </div>
                  {p.requester && (
                    <div className="truncate text-xs text-muted-foreground">
                      Žádá: {p.requester.full_name || p.requester.email}
                    </div>
                  )}
                  {p.description && <div className="mt-1 text-sm">{p.description}</div>}
                </div>
                <div className="flex gap-1">
                  {isAdmin && p.status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "approved")}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && p.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "rejected")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}