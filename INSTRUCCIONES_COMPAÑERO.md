# Instrucciones para el compañero con los CSVs
# NASA Space Apps Challenge — BRASA Backend en Render

## ⚡ Pasos rápidos (30 minutos total)

### 1. Asegúrate de tener el repo actualizado
```bash
git pull origin main
```

### 2. Instalar dependencias Python
```bash
cd backend
pip install -r requirements.txt
```

### 3. Copiar los CSVs de NASA FIRMS a la carpeta correcta
Coloca TODOS los archivos `.csv` en:
```
data/raw/
```
(Esta carpeta ya existe en el repo)

### 4. Generar la base de datos SQLite
```bash
python ingest.py
```
Esto crea el archivo `backend/brasa.db` con todos los datos procesados.

### 5. Verificar que funcionó localmente (opcional pero recomendado)
```bash
# En la carpeta backend:
uvicorn main:app --port 8000

# Probar en otra terminal:
curl http://localhost:8000/health
# Debe responder: {"status":"ok","db":true}
```

### 6. Commitear la base de datos al repositorio

> ⚠️ Si brasa.db pesa más de 100MB, primero configura Git LFS (ver sección abajo)

```bash
# Desde la raíz del proyecto:
git add backend/brasa.db
git commit -m "feat: add real NASA FIRMS SQLite database"
git push origin main
```

---

## Si brasa.db pesa más de 100 MB → usar Git LFS

```bash
# Instalar Git LFS (una sola vez)
git lfs install

# Rastrear archivos .db con LFS
git lfs track "*.db"
git add .gitattributes

# Luego commitear normalmente
git add backend/brasa.db
git commit -m "feat: add NASA FIRMS database via Git LFS"
git push origin main
```

---

## 7. Desplegar en Render

1. Ir a https://render.com → **New → Web Service**
2. Conectar el repositorio de GitHub del proyecto
3. Render detecta automáticamente el `render.yaml` ✅
4. Hacer clic en **Create Web Service**
5. Esperar ~3 minutos a que termine el deploy
6. Copiar la URL pública (ej: `https://brasa-api.onrender.com`)

---

## 8. Avisar a tu compañera la URL del backend

Ella solo necesita editar su `.env`:
```env
VITE_USE_MOCK=false
VITE_API_URL=https://brasa-api.onrender.com   ← la URL de Render
```

Y reiniciar el frontend con `npm run dev` 🎉

---

## Notas importantes

- El plan **gratuito de Render** pone el servicio a dormir tras 15 min de inactividad
  → La primera petición tarda ~30 seg en despertar (normal en demos)
- El `brasa.db` se incluye en el deploy; NO se ejecuta `ingest.py` en Render
- Los CSVs originales **no** se suben a GitHub (solo el .db procesado)
