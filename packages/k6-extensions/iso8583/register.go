package iso8583

import "go.k6.io/k6/js/modules"

func init() {
	modules.Register("k6/x/iso8583", New())
}

type RootModule struct{}

func New() *RootModule {
	return &RootModule{}
}

func (*RootModule) NewModuleInstance(vu modules.VU) modules.Instance {
	return &ModuleInstance{vu: vu}
}

type ModuleInstance struct {
	vu modules.VU
}

func (mi *ModuleInstance) Exports() modules.Exports {
	return modules.Exports{
		Named: map[string]interface{}{
			"Client":  NewClient,
			"Message": NewMessage,
		},
	}
}
