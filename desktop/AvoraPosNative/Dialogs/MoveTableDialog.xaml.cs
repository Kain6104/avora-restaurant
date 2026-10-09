using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AvoraPosNative.Models;

namespace AvoraPosNative.Dialogs
{
    public partial class MoveTableDialog : Window
    {
        private readonly PosTable _currentTable;
        private PosTable? _selectedDestinationTable;
        private Button? _lastSelectedBtn;

        public PosTable? DestinationTable => _selectedDestinationTable;
        public string? SelectedTargetTableId => _selectedDestinationTable?.Id;

        public MoveTableDialog(PosTable currentTable, List<PosTable> allTables)
        {
            InitializeComponent();
            _currentTable = currentTable;
            txtCurrentTable.Text = $"Từ bàn: {currentTable.Name} ({currentTable.AreaName})";

            pnlVacantTables.Children.Clear();
            foreach (var table in allTables)
            {
                if (table.Id == currentTable.Id || table.VisualStatus != "VACANT") continue;

                var btn = new Button
                {
                    Width = 110,
                    Height = 65,
                    Margin = new Thickness(6),
                    Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFFFF")),
                    BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1")),
                    BorderThickness = new Thickness(1.5),
                    Cursor = System.Windows.Input.Cursors.Hand,
                    Tag = table
                };

                var sp = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
                sp.Children.Add(new TextBlock { Text = table.Name, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")), HorizontalAlignment = HorizontalAlignment.Center });
                sp.Children.Add(new TextBlock { Text = $"{table.AreaName} • {table.Capacity} khách", FontSize = 10, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#64748B")), HorizontalAlignment = HorizontalAlignment.Center });
                btn.Content = sp;

                btn.Click += (s, e) =>
                {
                    if (_lastSelectedBtn != null)
                    {
                        _lastSelectedBtn.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1"));
                        _lastSelectedBtn.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFFFF"));
                    }
                    _selectedDestinationTable = table;
                    btn.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2563EB"));
                    btn.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EFF6FF"));
                    _lastSelectedBtn = btn;
                    btnConfirm.IsEnabled = true;
                };

                pnlVacantTables.Children.Add(btn);
            }

            if (pnlVacantTables.Children.Count == 0)
            {
                pnlVacantTables.Children.Add(new TextBlock { Text = "Không có bàn trống nào trong nhà hàng.", Foreground = Brushes.OrangeRed, Margin = new Thickness(20) });
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedDestinationTable == null) return;
            DialogResult = true;
            Close();
        }
    }
}
