import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import { Line } from "react-chartjs-2";

import styles from "./PriceChart.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

function PriceChart({ price = 0, history = [] }) {
  const points = history.length ? history : [{ date: "Current", price }];
  const data = {
    labels: points.map((point) => point.date),

    datasets: [
      {
        label: "Price",
        data: points.map((point) => point.price),

        borderColor: "#31734f",
        backgroundColor: "rgba(49, 115, 79, 0.11)",

        borderWidth: 2,

        tension: 0.4,

        fill: true,

        pointRadius: 4,

        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,

    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false,
      },

      tooltip: {
        callbacks: {
          label: function (context) {
            return ` ₹${context.parsed.y.toLocaleString("en-IN")}`;
          },
        },
      },
    },

    scales: {
      y: {
        ticks: {
          callback: function (value) {
            return `₹${value.toLocaleString("en-IN")}`;
          },
        },
      },

      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className={styles.chartContainer}>
      <Line data={data} options={options} />
    </div>
  );
}

export default PriceChart;