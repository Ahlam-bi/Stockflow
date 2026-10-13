export function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function notFound(req, res) {
  res.status(404).json({
    message: `Route introuvable: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.status >= 500 || !error.status) {
    console.error(error);
  }

  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Paramètres ou données invalides.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      message: "Cette valeur existe déjà.",
    });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      message:
        "Cette ressource est utilisée et ne peut pas être supprimée.",
    });
  }

  const status = error.status || 500;

  res.status(status).json({
    message:
      status === 500
        ? "Erreur interne du serveur."
        : error.message,
  });
}
