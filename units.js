// Unidades e conversões. Cada tabela guarda o fator para a unidade base (a primeira de cada lista).
const Units = {
  torque: { "N·m": 1, "N·cm": 0.01, "mN·m": 0.001, "kgf·cm": 0.00980665, "gf·cm": 0.0000980665 },
  rotacao: { "RPM": 1, "rad/s": 60 / (2 * Math.PI) },
  potencia: { "W": 1, "mW": 0.001, "kW": 1000, "cv": 735.49875, "hp": 745.699872 },
  tensao: { "V": 1, "mV": 0.001 },
  corrente: { "A": 1, "mA": 0.001 },
  carga: { "mAh": 1, "Ah": 1000 },
  volume: { "cm³": 1, "L": 1000, "mm³": 0.001 },
  litros: { "L": 1, "mL": 0.001 },
  velocidade: { "km/h": 1, "m/s": 3.6 },
  toBase(k, x, u) { return x * Units[k][u]; },
  fromBase(k, x, u) { return x / Units[k][u]; }
};
