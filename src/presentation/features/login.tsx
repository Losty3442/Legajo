"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  GraduationCap, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  UserCheck, 
  Sparkles, 
  School, 
  Building2, 
  Scale, 
  Award,
  AlertCircle,
  LogIn,
  KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../provider";
import { INSTITUTIONAL_ACCOUNTS, roleUseCases, type AuthUser, type Role } from "../../domain/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** Casos de uso que el rol puede ejecutar en el prototipo (§5 del Análisis v2.0). */
function UseCaseChips({ role, tone = "light" }: { role: Role; tone?: "light" | "dark" }) {
  const cases = roleUseCases[role] ?? [];
  return (
    <div className="flex flex-wrap gap-1">
      {cases.map(uc => (
        <span
          key={uc.code}
          title={`${uc.code} · ${uc.name}${uc.route ? ` · ${uc.route}` : ""}${uc.pending ? " · Fase institucional" : ""}`}
          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold ${
            uc.pending
              ? "bg-slate-50 text-slate-400 border-slate-200"
              : tone === "dark"
                ? "bg-white/10 text-teal-100 border-teal-500/40"
                : "bg-teal-50 text-teal-800 border-teal-200"
          }`}
        >
          {uc.code}
        </span>
      ))}
    </div>
  );
}

export function LoginView() {
  const router = useRouter();
  const { login, logout, currentUser, isAuthenticated } = useWorkspace();

  const [activeTab, setActiveTab] = useState<string>("credentials");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg("Ingrese su correo institucional (@unp.edu.pe).");
      return;
    }

    if (!password) {
      setErrorMsg("Ingrese su contraseña de acceso.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Find matching user by email or fallback to an appropriate account
      const matched = INSTITUTIONAL_ACCOUNTS.find(
        acc => acc.email.toLowerCase() === cleanEmail || 
               acc.email.split("@")[0].toLowerCase() === cleanEmail.split("@")[0]
      );

      if (matched) {
        login(matched);
        toast.success(`Bienvenido(a), ${matched.name}`, {
          description: `Sesión iniciada con rol de ${matched.role.replace("_", " ")}.`
        });
        setLoading(false);
        router.push("/");
      } else if (cleanEmail.includes("@unp.edu.pe") || cleanEmail.includes("@ejemplo.test")) {
        // Create an institutional docente session if it is an UNP email
        const customDocente: AuthUser = {
          id: "custom-" + Date.now(),
          name: cleanEmail.split("@")[0].replace(".", " ").toUpperCase(),
          email: cleanEmail,
          role: "docente",
          teacherId: "t1",
          faculty: "Ingeniería · UNP",
          department: "Informática · UNP",
          category: "Auxiliar",
          avatarInitials: cleanEmail.slice(0, 2).toUpperCase()
        };
        login(customDocente);
        toast.success(`Bienvenido(a), ${customDocente.name}`);
        setLoading(false);
        router.push("/");
      } else {
        // Show helpful message
        setErrorMsg("Correo institucional no registrado. Utilice una cuenta de prueba (@unp.edu.pe) o el acceso rápido.");
        setLoading(false);
      }
    }, 450);
  };

  const handleQuickLogin = (account: AuthUser) => {
    setLoading(true);
    setTimeout(() => {
      login(account);
      toast.success(`Sesión iniciada como ${account.name}`, {
        description: `Ingresando con perfil de ${account.role.replace("_", " ")}.`
      });
      setLoading(false);
      router.push("/");
    }, 200);
  };

  const handleOidcLogin = () => {
    setLoading(true);
    setTimeout(() => {
      // Default OIDC demo login as teacher María Valeria Ríos or Ana Salas
      const defaultOidc = INSTITUTIONAL_ACCOUNTS.find(a => a.id === "t1")!;
      login(defaultOidc);
      toast.success(`Autenticación OIDC completada`, {
        description: `Sesión validada mediante Google Workspace institucional (@unp.edu.pe).`
      });
      setLoading(false);
      router.push("/");
    }, 500);
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case "docente":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "legajos":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "comision":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "decanato":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "consejo_facultad":
      case "consejo_universitario":
        return "bg-slate-100 text-slate-800 border-slate-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="login-page-wrapper min-h-[calc(100vh-140px)] flex flex-col justify-center items-center py-10 px-4">
      {/* Background decoration elements */}
      <div className="w-full max-w-4xl mx-auto space-y-6">
        
        {/* Institutional Header Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-white shadow-sm border border-slate-200 rounded-2xl mb-1 text-teal-800">
            <span className="p-2 bg-teal-50 rounded-xl mr-3 text-teal-700">
              <GraduationCap className="h-8 w-8" />
            </span>
            <div className="text-left">
              <h2 className="text-sm font-bold tracking-widest text-slate-500 uppercase">
                Universidad Nacional de Piura
              </h2>
              <span className="text-xs text-teal-700 font-semibold tracking-wide">
                Fundada en 1961 · Resolución N.° 255-CU-2025
              </span>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Sistema Integrado de Legajo y Promoción Docente
          </h1>
          <p className="max-w-2xl mx-auto text-sm text-slate-600">
            Gestión digital de hoja de vida, verificación trazable de méritos y evaluación de ascensos para docentes ordinarios de la UNP.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Portal Seguro OIDC
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
              <Award className="h-3.5 w-3.5" /> Proceso 2026-I / 2026-II
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
              <Building2 className="h-3.5 w-3.5" /> Vicerrectorado Académico
            </span>
          </div>
        </div>

        {/* Existing Session Alert (if already authenticated) */}
        {isAuthenticated && currentUser && (
          <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                {currentUser.avatarInitials}
              </div>
              <div>
                <p className="text-xs text-teal-800 font-medium">Actualmente autenticado en este equipo:</p>
                <p className="text-sm font-semibold text-slate-900">
                  {currentUser.name} <span className="text-xs font-normal text-slate-500">({currentUser.email})</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] px-2 py-0.2 rounded border font-medium ${getRoleBadgeColor(currentUser.role)}`}>
                    {currentUser.role.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-[11px] text-slate-500">{currentUser.faculty}</span>
                </div>
                <div className="mt-2">
                  <p className="text-[10px] uppercase tracking-wide text-teal-700/80 font-bold mb-1">Casos de uso habilitados</p>
                  <UseCaseChips role={currentUser.role} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  logout();
                  toast.info("Sesión cerrada");
                }}
                className="text-xs text-slate-700"
              >
                Cerrar sesión
              </Button>
              <Button 
                size="sm" 
                onClick={() => router.push("/")}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs gap-1"
              >
                Continuar al Panel <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Main Card with Login Modes */}
        <Card className="border border-slate-200/80 shadow-md bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
              <KeyRound className="h-5 w-5 text-teal-700" /> Iniciar Sesión en el Sistema
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Acceda con sus credenciales institucionales o seleccione una cuenta oficial de demostración académica.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/90 p-1 rounded-xl">
                <TabsTrigger 
                  value="credentials" 
                  className="rounded-lg text-xs font-medium py-2.5 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-sm"
                >
                  <Mail className="h-3.5 w-3.5 mr-2" /> Credenciales Institucionales
                </TabsTrigger>
                <TabsTrigger 
                  value="quick" 
                  className="rounded-lg text-xs font-medium py-2.5 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-sm"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-2" /> Cuentas Oficiales de Prueba
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Formulario con Correo Institucional */}
              <TabsContent value="credentials" className="space-y-5 focus-visible:outline-none">
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="unp-email" className="text-xs font-semibold text-slate-700">
                      Correo Electrónico Institucional UNP
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="unp-email"
                        type="email"
                        placeholder="usuario@unp.edu.pe"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                        autoComplete="email"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ejemplos sugeridos: <button type="button" onClick={() => setEmail("mvrios@unp.edu.pe")} className="text-teal-700 underline font-mono">mvrios@unp.edu.pe</button> (Docente) o <button type="button" onClick={() => setEmail("asalas@unp.edu.pe")} className="text-teal-700 underline font-mono">asalas@unp.edu.pe</button> (Legajos).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="unp-password" className="text-xs font-semibold text-slate-700">
                        Contraseña / Código de Acceso
                      </Label>
                      <button 
                        type="button" 
                        onClick={() => setPassword("unp2026")}
                        className="text-[11px] text-teal-700 hover:underline"
                      >
                        Autocompletar clave demo
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="unp-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>Recordar sesión en este navegador</span>
                    </label>
                    <span className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      Soporte técnico OTI
                    </span>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2.5 rounded-lg shadow-sm transition-all gap-2"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Autenticando...
                      </span>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" /> Iniciar Sesión Institucional
                      </>
                    )}
                  </Button>
                </form>

                {/* Federate OIDC UNP Option */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-400 font-medium">O conector institucional</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={handleOidcLogin}
                  className="w-full border-slate-200 hover:bg-slate-50 py-2.5 text-xs text-slate-700 flex items-center justify-center gap-3"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  Iniciar sesión con Google Workspace UNP (@unp.edu.pe)
                </Button>
              </TabsContent>

              {/* Tab 2: Acceso Rápido por Rol Oficial */}
              <TabsContent value="quick" className="space-y-4 focus-visible:outline-none">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Acceso Rápido para Demostración Académica:</span>
                    <p className="mt-0.5 text-slate-500">
                      Haga clic en cualquiera de las siguientes cuentas oficiales para entrar de inmediato con ese perfil y probar los casos de uso normados.
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Cada cuenta lista sus casos de uso (CUS): en <span className="text-teal-700 font-semibold">verde</span> los disponibles en el prototipo y en <span className="text-slate-400 font-semibold">gris</span> los declarados para la fase institucional.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {INSTITUTIONAL_ACCOUNTS.map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => handleQuickLogin(acc)}
                      className="group p-3.5 rounded-xl border border-slate-200 hover:border-teal-400 bg-white hover:bg-teal-50/40 transition-all cursor-pointer shadow-sm flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-teal-100 text-slate-700 group-hover:text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                          {acc.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-teal-900 truncate">
                              {acc.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-teal-700 font-medium font-mono truncate">
                            {acc.email}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {acc.department || acc.faculty}
                          </p>
                          <div className="mt-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">
                              Casos de uso
                            </p>
                            <UseCaseChips role={acc.role} />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getRoleBadgeColor(acc.role)}`}>
                          {acc.role === "docente" && acc.category ? `${acc.category}` : acc.role.replace("_", " ")}
                        </span>
                        <span className="text-[11px] text-teal-700 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 font-medium transition-opacity">
                          Entrar <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="bg-slate-50/80 border-t border-slate-100 py-3.5 px-6 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0" />
              <span>Conforme a la Ley N.° 29733 de Protección de Datos Personales.</span>
            </div>
            <span className="text-[11px] text-slate-400">
              UNP · Piura, Perú
            </span>
          </CardFooter>
        </Card>

        {/* Informative summary box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <School className="h-4 w-4" />
            </div>
            <div>
              <strong className="block text-slate-800">Docentes Ordinarios</strong>
              <span className="text-slate-500">Legajo único, méritos y postulación.</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <strong className="block text-slate-800">Comisión Evaluadora</strong>
              <span className="text-slate-500">Calificación de rúbrica e inmutabilidad.</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <strong className="block text-slate-800">Instancias Colegiadas</strong>
              <span className="text-slate-500">Decanato, Consejo de Facultad y CU.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
