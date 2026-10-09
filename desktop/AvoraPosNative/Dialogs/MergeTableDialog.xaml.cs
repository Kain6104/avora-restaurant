using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AvoraPosNative.Models;

namespace AvoraPosNative.Dialogs
{
    public partial class MergeTableDialog : Window
    {
        private readonly PosTable _currentTable;
        private PosTable? _selectedTargetTable;
        private Button? _lastSelectedBtn;

        public PosTable? TargetTable => _selectedTargetTable;
        public string? SelectedTargetTableId => _selectedTargetTable?.Id;

        public MergeTableDialog(PosTable currentTable, List<PosTable> allTables)
        {
            InitializeComponent();
            _currentTable = currentTable;
            txtCurrentTable.Text = $"Gộp đơn từ: {currentTable.Name} ({currentTable.AreaName})";

            pnlOccupiedTables.Children.Clear();
            foreach (var table in allTables)
            {
                if (table.Id == currentTable.Id || table.VisualStatus == "VACANT") continue;

                var btn = new Button
                {
                    Width = 130,
                    Height = 70,
                    Margin = new Thickness(6),
                    Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFFFF")),
                    BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1")),
                    BorderThickness = new Thickness(1.5),
                    Cursor = System.Windows.Input.Cursors.Hand,
                    Tag = table
                };

                var sp = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
                sp.Children.Add(new TextBlock { Text = table.Name, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")), HorizontalAlignment = HorizontalAlignment.Center });
                string amount = table.CurrentOrder?.TotalAmount > 0 ? $"{table.CurrentOrder.TotalAmount:N0}đ" : "Đang phục vụ";
                sp.Children.Add(new TextBlock { Text = amount, FontSize = 11, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#D97706")), FontWeight = FontWeights.Bold, HorizontalAlignment = HorizontalAlignment.Center });
                btn.Content = sp;

                btn.Click += (s, e) =>
                {
                    if (_lastSelectedBtn != null)
                    {
                        _lastSelectedBtn.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1"));
                        _lastSelectedBtn.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFFFF"));
                    }
                    _selectedTargetTable = table;
                    btn.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#D97706"));
                    btn.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FEF3C7"));
                    _lastSelectedBtn = btn;
                    btnConfirm.IsEnabled = true;
                };

                pnlOccupiedTables.Children.Add(btn);
            }

            if (pnlOccupiedTables.Children.Count == 0)
            {
                pnlOccupiedTables.Children.Add(new TextBlock { Text = "Không có bàn nào khác đang có khách để gộp.", Foreground = Brushes.OrangeRed, Margin = new Thickness(20) });
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedTargetTable == null) return;
            DialogResult = true;
            Close();
        }
    }
}
